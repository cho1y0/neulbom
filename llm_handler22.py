# llm_handler.py
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from dotenv import load_dotenv


class LLMHandler:
    """
    보미 LLM 핸들러 (존댓말 고정 + 세션별 히스토리 분리 + SDK 호환)

    ✅ 해결 포인트
    - openai Python SDK (구버전/신버전) 모두 지원
    - 모델 접근 불가/모델명 오류 시 fallback 모델로 자동 재시도
    - 세션별 history 분리 (섞임 방지)
    - 존댓말 고정 + 반말 감지 시 1회 재작성
    """

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_completion_tokens: int = 900,
        max_turns: int = 10,
    ):
        print("⏳ OpenAI 초기화 중...")

        # 1) .env 로딩 (기존 구조 유지)
        env_path = Path(__file__).parent / "api-key" / "openapi.env"
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            print(f"   🔑 키 파일 로딩: {env_path}")
        else:
            print(f"   ⚠️ 키 파일을 못 찾았습니다: {env_path}")

        # 2) API 키 확인
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY가 없습니다. api-key/openapi.env를 확인해 주세요.")

        # 3) 모델 설정 (환경변수 우선)
        env_model = os.getenv("OPENAI_MODEL", "").strip()
        # 기본값은 접근성이 높은 모델로 (gpt-5-mini는 계정에 따라 미지원일 수 있음)
        self.primary_model = (model or env_model or "gpt-4o-mini").strip()

        # fallback 모델 목록 (필요 시 추가 가능)
        # - primary_model 먼저 시도 → 실패하면 아래 순서대로 시도
        self.model_fallbacks = self._build_model_fallbacks(self.primary_model)

        self.temperature = float(temperature)
        self.max_completion_tokens = int(max_completion_tokens)
        self.max_turns = int(max_turns)

        # 4) SDK 호환 초기화 (신버전 우선, 실패 시 구버전)
        self._sdk_mode, self._client = self._init_openai_client(self.api_key)

        # 5) 세션별 히스토리 + 락
        self._histories: Dict[str, List[Dict[str, str]]] = {}
        self._lock = threading.Lock()

        print(f"✅ OpenAI 준비 완료 (mode={self._sdk_mode}, model={self.primary_model})")

    # -------------------------
    # Public
    # -------------------------
    def chat(
        self,
        user_input: str,
        emotion_info: Optional[Dict[str, Any]] = None,
        scores: Optional[Dict[str, Any]] = None,
        max_turns: Optional[int] = None,
        session_id: Optional[str] = None,
        extra_context: Optional[str] = None,
    ) -> str:
        if not user_input or not user_input.strip():
            return "네, 어르신. 무엇을 도와드릴까요?"

        sid = (session_id or "default").strip() or "default"
        turns_limit = int(max_turns) if max_turns is not None else self.max_turns

        system_prompt = self._build_system_prompt(emotion_info, scores, extra_context)

        with self._lock:
            history = self._histories.get(sid)
            if not history:
                history = [{"role": "system", "content": system_prompt}]
                self._histories[sid] = history
            else:
                history[0] = {"role": "system", "content": system_prompt}

            history.append({"role": "user", "content": user_input.strip()})
            self._trim_history_locked(history, turns_limit)
            messages = list(history)  # 스냅샷

        # LLM 호출 (모델 fallback 포함)
        ai_response, used_model = self._call_with_fallback(messages)

        ai_response = (ai_response or "").strip()
        ai_response = self._ensure_polite(ai_response)

        # 반말/톤 흔들림 감지 시 1회 재작성
        if self._looks_like_banmal(ai_response):
            ai_response = self._rewrite_to_polite(
                draft=ai_response,
                user_input=user_input,
                system_prompt=system_prompt,
                model=used_model,
            )
            ai_response = self._ensure_polite(ai_response)

        with self._lock:
            history = self._histories.get(sid, [{"role": "system", "content": system_prompt}])
            history.append({"role": "assistant", "content": ai_response})
            self._trim_history_locked(history, turns_limit)
            self._histories[sid] = history

        return ai_response or "죄송합니다, 어르신. 다시 한 번 말씀해 주시겠어요?"

    def reset_conversation(self, session_id: Optional[str] = None) -> None:
        with self._lock:
            if session_id is None:
                self._histories.clear()
                print("🧹 전체 대화 초기화")
            else:
                sid = (session_id or "default").strip() or "default"
                self._histories.pop(sid, None)
                print(f"🧹 세션 대화 초기화: {sid}")

    # -------------------------
    # OpenAI init (SDK 호환)
    # -------------------------
    def _init_openai_client(self, api_key: str) -> Tuple[str, Any]:
        # 1) 신버전 SDK 시도: from openai import OpenAI
        try:
            from openai import OpenAI  # type: ignore
            client = OpenAI(api_key=api_key)
            return "v1", client
        except Exception:
            pass

        # 2) 구버전 SDK: import openai; openai.api_key=...
        try:
            import openai  # type: ignore
            openai.api_key = api_key
            return "legacy", openai
        except Exception as e:
            raise RuntimeError(f"openai SDK 초기화 실패: {e}")

    def _build_model_fallbacks(self, primary: str) -> List[str]:
        # 중복 제거 + 안정적인 후보들
        candidates = [primary, "gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"]
        out = []
        for m in candidates:
            if m and m not in out:
                out.append(m)
        return out

    # -------------------------
    # Call with fallback models
    # -------------------------
    def _call_with_fallback(self, messages: List[Dict[str, str]]) -> Tuple[str, str]:
        last_err = None
        for model in self.model_fallbacks:
            try:
                text = self._call_chat_completion(model, messages)
                return text, model
            except Exception as e:
                last_err = e
                msg = str(e)
                print(f"❌ OpenAI 호출 실패 (model={model}): {type(e).__name__}: {msg}")

                # 모델 미지원/모델명 오류일 때는 다음 모델로 계속
                lowered = msg.lower()
                if "model" in lowered and ("not found" in lowered or "does not exist" in lowered or "no such model" in lowered):
                    continue
                # 그 외(키/네트워크/권한/쿼터 등)는 계속 시도해도 의미 없을 수 있어 중단
                break

        # 여기까지 왔으면 전부 실패
        raise RuntimeError(f"OpenAI 호출 실패: {last_err}")

    def _call_chat_completion(self, model: str, messages: List[Dict[str, str]]) -> str:
        if self._sdk_mode == "v1":
            # 신버전
            resp = self._client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=self.temperature,
                max_completion_tokens=self.max_completion_tokens,
            )
            return (resp.choices[0].message.content or "").strip()

        # 구버전
        # (구버전은 파라미터가 max_tokens인 경우가 많음)
        resp = self._client.ChatCompletion.create(
            model=model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=self.max_completion_tokens,
        )
        return (resp["choices"][0]["message"]["content"] or "").strip()

    # -------------------------
    # Prompts
    # -------------------------
    def _build_system_prompt(
        self,
        emotion_info: Optional[Dict[str, Any]],
        scores: Optional[Dict[str, Any]],
        extra_context: Optional[str],
    ) -> str:
        parts = [self._build_base_prompt()]

        if extra_context:
            parts.append("【추가 맥락】\n" + str(extra_context).strip())

        if emotion_info:
            parts.append(self._build_emotion_prompt(emotion_info))

        if scores:
            rp = self._build_risk_prompt(scores)
            if rp:
                parts.append(rp)

        return "\n\n".join(parts).strip()

    def _build_base_prompt(self) -> str:
        return (
            "당신은 어르신을 도와드리는 돌봄 대화 도우미 '보미'입니다.\n\n"
            "【필수 규칙】\n"
            "- 반드시 존댓말(하십시오/하세요체)로만 답변합니다. 반말/친구말투/비속어는 금지합니다.\n"
            "- AI/모델/프롬프트 같은 기술 설명은 하지 않습니다.\n"
            "- 한 번에 1~2문장으로 짧고 또렷하게 답합니다.\n"
            "- 먼저 공감 1문장 → 핵심 안내 1문장 순서로 답합니다.\n"
            "- 의료/진단은 하지 말고, 필요하면 의료진 상담을 권합니다.\n"
        )

    def _build_emotion_prompt(self, emotion_info: Dict[str, Any]) -> str:
        final_emotion = emotion_info.get("final_emotion", "중립")
        conf = float(emotion_info.get("audio_conf", 0.5) or 0.5)

        prompt = (
            "【현재 감정 상태】\n"
            f"- 감정: {final_emotion}\n"
            f"- 확신도: {conf:.2f}\n\n"
            "【대화 전략】\n"
        )

        if final_emotion == "슬픔":
            prompt += "- 따뜻하게 공감하고 위로합니다. 부담 없는 질문 1개만 덧붙일 수 있습니다."
        elif final_emotion == "분노":
            prompt += "- 차분히 경청하고 감정을 인정합니다. 논쟁하거나 지적하지 않습니다."
        elif final_emotion == "불안":
            prompt += "- 안심시키고 지금 할 수 있는 간단한 행동을 제안합니다. 선택지는 최대 2개입니다."
        elif final_emotion == "공포":
            prompt += "- 매우 부드럽고 안정적으로 말합니다. 안전을 확인하는 짧은 안내를 제공합니다."
        elif final_emotion == "기쁨":
            prompt += "- 함께 기뻐하고 긍정적으로 맞장구칩니다. 질문은 1개만 합니다."
        else:
            prompt += "- 편안한 톤으로 자연스럽게 대화를 이어갑니다."

        return prompt

    def _build_risk_prompt(self, scores: Dict[str, Any]) -> Optional[str]:
        avg = float(scores.get("average", 100) or 100)
        emo = float(scores.get("emotion", 100) or 100)

        if avg < 50 or emo < 40:
            return (
                "【주의: 고위험 상태 가능】\n"
                "- 더 부드럽게 확인 질문을 1개 포함합니다.\n"
                "- 위급 징후가 의심되면 보호자 또는 의료진 도움을 권합니다."
            )
        if avg < 65 or emo < 60:
            return (
                "【주의: 관심 필요】\n"
                "- 위로와 격려를 포함하고 무리한 질문은 피합니다."
            )
        return None

    # -------------------------
    # History
    # -------------------------
    def _trim_history_locked(self, history: List[Dict[str, str]], max_turns: int) -> None:
        keep = (max_turns * 2) + 1  # system 1 + (user/assistant)*max_turns
        if len(history) > keep:
            history[:] = [history[0]] + history[-(keep - 1):]

    # -------------------------
    # Politeness guardrails
    # -------------------------
    def _ensure_polite(self, text: str) -> str:
        if not text:
            return "네, 어르신. 무엇을 도와드릴까요?"
        t = text.strip()
        # 너무 길면 줄바꿈 과다만 컷
        if t.count("\n") >= 8:
            t = "\n".join(t.splitlines()[:8]).strip()
        return t

    def _looks_like_banmal(self, text: str) -> bool:
        if not text:
            return False
        markers = ["야", "해라", "했냐", "하지마", "알겠어", "됐어", "뭐야", "해봐", "하자", "했어"]
        return any(m in text for m in markers)

    def _rewrite_to_polite(self, draft: str, user_input: str, system_prompt: str, model: str) -> str:
        prompt = (
            "아래 초안을 어르신께 드리는 답변으로 다시 작성하세요.\n"
            "- 반드시 존댓말(하십시오/하세요체)\n"
            "- 1~2문장\n"
            "- 공감 1문장 + 핵심 안내 1문장\n\n"
            f"【사용자 말씀】 {user_input}\n"
            f"【초안】 {draft}\n"
        )
        try:
            if self._sdk_mode == "v1":
                resp = self._client.chat.completions.create(
                    model=model,
                    messages=[{"role": "system", "content": system_prompt},
                              {"role": "user", "content": prompt}],
                    temperature=max(0.1, min(self.temperature, 0.4)),
                    max_completion_tokens=min(350, self.max_completion_tokens),
                )
                out = (resp.choices[0].message.content or "").strip()
                return out or "죄송합니다, 어르신. 다시 한 번 말씀해 주시겠어요?"
            else:
                resp = self._client.ChatCompletion.create(
                    model=model,
                    messages=[{"role": "system", "content": system_prompt},
                              {"role": "user", "content": prompt}],
                    temperature=max(0.1, min(self.temperature, 0.4)),
                    max_tokens=min(350, self.max_completion_tokens),
                )
                out = (resp["choices"][0]["message"]["content"] or "").strip()
                return out or "죄송합니다, 어르신. 다시 한 번 말씀해 주시겠어요?"
        except Exception as e:
            print(f"⚠️ 존댓말 재작성 실패: {type(e).__name__}: {e}")
            return "죄송합니다, 어르신. 다시 한 번 말씀해 주시겠어요?"
