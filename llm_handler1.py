# llm_handler.py
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Any

from dotenv import load_dotenv
import openai


class LLMHandler:
    """
    보미 LLM 핸들러 (감정/점수 기반 응답)

    ✅ 이 버전의 핵심 개선
    1) "존댓말 고정" (반말/친구말투 금지)
    2) 세션별(history) 분리 (어르신/브라우저 세션 섞임 방지)
    3) 동시성 안전(LOCK)
    4) 말투가 흔들리면 자동 1회 "존댓말 재작성" 리트라이
    5) 기존 bomi.py 호출과 호환 (session_id 인자 없이도 동작)

    사용 예)
      llm = LLMHandler()
      text = llm.chat("오늘 날씨 알려줘", emotion_info=..., scores=...)
      # 또는
      text = llm.chat("오늘 날씨 알려줘", session_id="senior_1", emotion_info=..., scores=...)
    """

    def __init__(
        self,
        model: str = "gpt-5-mini",
        temperature: float = 0.3,
        max_completion_tokens: int = 900,
        max_turns: int = 10,
    ):
        print("⏳ OpenAI API 초기화 중...")

        # 1) 키 파일 위치
        env_path = Path(__file__).parent / "api-key" / "openapi.env"

        # 2) .env 로딩
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            print(f"   🔑 API 키 파일 로딩: {env_path}")
        else:
            print(f"   ⚠️  경고: 키 파일을 못 찾았습니다. ({env_path})")

        # 3) API 키 확인
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            print("\n❌ [오류] OpenAI API 키가 없습니다.")
            raise ValueError("API Key Missing")

        # 4) 클라이언트 연결
        self.client = openai.OpenAI(api_key=self.api_key)

        # 기본 설정
        self.model = model
        self.temperature = float(temperature)
        self.max_completion_tokens = int(max_completion_tokens)
        self.max_turns = int(max_turns)

        # ✅ 세션별 히스토리 저장소
        self._histories: Dict[str, List[Dict[str, str]]] = {}
        self._lock = threading.Lock()

        print("✅ OpenAI API 준비 완료 (보미: 존댓말 고정 / 세션 분리)")

    # =========================
    # Public API
    # =========================
    def chat(
        self,
        user_input: str,
        emotion_info: Optional[Dict[str, Any]] = None,
        scores: Optional[Dict[str, Any]] = None,
        max_turns: Optional[int] = None,
        session_id: Optional[str] = None,
        extra_context: Optional[str] = None,
    ) -> str:
        """
        대화 함수 (감정 + 점수 기반)

        Args:
            user_input: 사용자 입력 텍스트
            emotion_info: 감정 분석 결과 딕셔너리
            scores: 점수 딕셔너리
            max_turns: 대화 턴 제한(세션별) - 없으면 self.max_turns
            session_id: 세션 식별자(어르신/브라우저별 분리용) - 없으면 "default"
            extra_context: (선택) 어르신 페르소나/더미정보 등을 문자열로 추가

        Returns:
            ai_response: AI 응답 텍스트(존댓말)
        """
        if not user_input or not user_input.strip():
            return "네, 어르신. 무엇을 도와드릴까요?"

        sid = (session_id or "default").strip() or "default"
        turns_limit = int(max_turns) if max_turns is not None else self.max_turns

        # 1) 시스템 프롬프트 생성
        system_prompt = self._build_system_prompt(
            emotion_info=emotion_info,
            scores=scores,
            extra_context=extra_context,
        )

        # 2) 세션 히스토리 준비
        with self._lock:
            history = self._histories.get(sid)
            if not history:
                history = [{"role": "system", "content": system_prompt}]
                self._histories[sid] = history
            else:
                # 시스템 프롬프트는 매 턴 최신 상태로 업데이트(감정/점수 반영)
                history[0] = {"role": "system", "content": system_prompt}

            history.append({"role": "user", "content": user_input.strip()})

            # 턴 제한(메모리 관리)
            self._trim_history_locked(history, turns_limit)

            # 호출에 사용할 스냅샷(동시성 안전)
            messages = list(history)

        # 3) LLM 호출
        ai_response = self._call_chat_completion(messages)

        # 4) 존댓말/품질 가드레일
        ai_response = self._ensure_polite(ai_response)
        if self._looks_like_banmal(ai_response):
            # 자동 1회 재작성 시도
            ai_response = self._rewrite_to_polite(ai_response, user_input=user_input, system_prompt=system_prompt)

        # 5) 히스토리 저장
        with self._lock:
            history = self._histories.get(sid, [{"role": "system", "content": system_prompt}])
            history.append({"role": "assistant", "content": ai_response})
            self._trim_history_locked(history, turns_limit)
            self._histories[sid] = history

        return ai_response

    def reset_conversation(self, session_id: Optional[str] = None) -> None:
        """세션 대화 초기화 (session_id 없으면 전체 초기화)"""
        with self._lock:
            if session_id is None:
                self._histories.clear()
                print("🧹 모든 대화 기억 초기화됨")
            else:
                sid = (session_id or "default").strip() or "default"
                self._histories.pop(sid, None)
                print(f"🧹 대화 기억 초기화됨 (session_id={sid})")

    def get_conversation_length(self, session_id: Optional[str] = None) -> int:
        """세션 대화 턴 수 반환"""
        sid = (session_id or "default").strip() or "default"
        with self._lock:
            history = self._histories.get(sid)
            if not history:
                return 0
            # system 1 + user/assistant 2n
            return max(0, (len(history) - 1) // 2)

    def generate_report(self, scores: Dict[str, Any], text_summary: str) -> str:
        """
        보호자용 리포트 생성 (간단 요약)
        """
        prompt = f"""다음 데이터를 바탕으로 노인의 상태를 보호자에게 전달할 간단한 리포트를 작성해주세요.

【 점수 데이터 】
- 평균 점수: {float(scores.get('average', 0)):.1f}점
- 감정 안정도: {float(scores.get('emotion', 0)):.1f}점
- 말의 속도: {float(scores.get('speed', 0)):.1f}점
- 어휘 다양성: {float(scores.get('vocabulary', 0)):.1f}점
- 반응 속도: {float(scores.get('response', 0)):.1f}점

【 대화 요약 】
{text_summary}

【 리포트 작성 가이드 】
- 보호자가 이해하기 쉽게 작성
- 걱정할 부분이 있으면 명확히 언급
- 긍정적인 부분도 함께 전달
- 3-4문장으로 간단히 요약
"""

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=350,
                temperature=0.5,
            )
            out = resp.choices[0].message.content or ""
            return out.strip() or f"평균 점수 {float(scores.get('average', 0)):.1f}점입니다. {text_summary}"
        except Exception as e:
            print(f"❌ 리포트 생성 오류: {e}")
            return f"평균 점수 {float(scores.get('average', 0)):.1f}점입니다. {text_summary}"

    # =========================
    # Internal helpers
    # =========================
    def _call_chat_completion(self, messages: List[Dict[str, str]]) -> str:
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_completion_tokens=self.max_completion_tokens,
                temperature=self.temperature,
            )
            text = resp.choices[0].message.content or ""
            return text.strip() or "네, 어르신. 다시 한 번 말씀해 주시겠어요?"
        except Exception as e:
            print(f"❌ API 오류 ({self.model}): {e}")
            return "죄송합니다, 어르신. 잠시 오류가 있었습니다. 다시 말씀해 주시겠어요?"

    def _trim_history_locked(self, history: List[Dict[str, str]], max_turns: int) -> None:
        """
        system 1개 + (user/assistant) * max_turns * 2 를 유지
        """
        if not history:
            return
        keep = (max_turns * 2) + 1
        if len(history) > keep:
            history[:] = [history[0]] + history[-(keep - 1):]

    # -------------------------
    # Prompt builders
    # -------------------------
    def _build_system_prompt(
        self,
        emotion_info: Optional[Dict[str, Any]],
        scores: Optional[Dict[str, Any]],
        extra_context: Optional[str],
    ) -> str:
        base = self._build_base_prompt()

        parts = [base]

        if extra_context:
            parts.append("【 추가 맥락 】\n" + str(extra_context).strip())

        if emotion_info:
            parts.append(self._build_emotion_prompt(emotion_info))

        if scores:
            risk_prompt = self._build_risk_prompt(scores)
            if risk_prompt:
                parts.append(risk_prompt)

        return "\n\n".join(parts).strip()

    def _build_base_prompt(self) -> str:
        # ✅ 존댓말 고정 / 어르신 대상 페르소나
        return (
            "당신은 어르신을 도와드리는 돌봄 대화 도우미 '보미'입니다.\n\n"
            "【 필수 규칙 】\n"
            "- 반드시 존댓말(하십시오/하세요체)로만 답변합니다. 반말/친구말투/비속어는 금지합니다.\n"
            "- AI, 모델, 시스템, 프롬프트 같은 기술 설명은 하지 않습니다.\n"
            "- 한 번에 1~2문장으로 짧고 또렷하게 답변합니다.\n"
            "- 먼저 공감(1문장) → 핵심 안내(1문장) 순서로 답합니다.\n"
            "- 의료/진단은 하지 말고, 필요하면 '의료진 상담'을 권합니다.\n"
            "- 사용자의 개인정보를 캐묻지 않습니다.\n"
        )

    def _build_emotion_prompt(self, emotion_info: Dict[str, Any]) -> str:
        final_emotion = emotion_info.get("final_emotion", "중립")
        confidence = float(emotion_info.get("audio_conf", 0.5) or 0.5)

        prompt = "【 현재 감정 상태 】\n"
        prompt += f"- 감정: {final_emotion}\n"
        prompt += f"- 확신도: {confidence:.2f}\n\n"
        prompt += "【 대화 전략 】\n"

        if final_emotion == "슬픔":
            prompt += (
                "- 따뜻하게 공감하고 위로합니다.\n"
                "- 부담스럽지 않은 질문 1개만 덧붙입니다."
            )
        elif final_emotion == "분노":
            prompt += (
                "- 차분히 경청하고, 감정을 인정하는 표현을 사용합니다.\n"
                "- 논쟁하거나 지적하지 않습니다."
            )
        elif final_emotion == "불안":
            prompt += (
                "- 안심시키고, 지금 할 수 있는 간단한 행동을 제안합니다.\n"
                "- 선택지는 최대 2개만 제시합니다."
            )
        elif final_emotion == "공포":
            prompt += (
                "- 매우 부드럽고 안정적으로 말합니다.\n"
                "- 안전 확인을 돕는 짧은 안내를 제공합니다."
            )
        elif final_emotion == "기쁨":
            prompt += (
                "- 함께 기뻐하고 긍정적으로 맞장구칩니다.\n"
                "- 대화를 자연스럽게 이어갈 질문 1개를 합니다."
            )
        else:
            prompt += (
                "- 편안한 톤을 유지하고, 자연스럽게 대화를 이어갑니다.\n"
                "- 어르신이 선택할 수 있는 간단한 옵션을 제시할 수 있습니다."
            )

        return prompt

    def _build_risk_prompt(self, scores: Dict[str, Any]) -> Optional[str]:
        avg_score = float(scores.get("average", 100) or 100)
        emotion_score = float(scores.get("emotion", 100) or 100)

        if avg_score < 50 or emotion_score < 40:
            return (
                "【 ⚠️ 주의: 고위험 상태 감지 】\n"
                "- 어르신 상태가 평소보다 좋지 않을 수 있습니다.\n"
                "- 더 부드럽게 확인 질문을 1개 포함합니다.\n"
                "- 응급/위급 징후가 의심되면 보호자 또는 의료진 도움을 권합니다."
            )
        if avg_score < 65 or emotion_score < 60:
            return (
                "【 주의: 관심 필요 】\n"
                "- 어르신 상태가 평소보다 불편하실 수 있습니다.\n"
                "- 위로와 격려를 포함하고, 무리한 질문은 피합니다."
            )
        return None

    # -------------------------
    # Politeness guardrails
    # -------------------------
    def _looks_like_banmal(self, text: str) -> bool:
        if not text:
            return False
        markers = ["야", "해라", "했냐", "하지마", "알겠어", "됐어", "뭐야", "해봐", "하자", "거야", "했어"]
        return any(m in text for m in markers)

    def _ensure_polite(self, text: str) -> str:
        if not text:
            return "네, 어르신. 무엇을 도와드릴까요?"
        t = text.strip()

        # 너무 길면 2문장 정도로 줄이도록(간단한 컷)
        # (정교한 요약은 모델에 맡기되, 여기서는 과도한 장문 방지)
        if t.count("\n") >= 6:
            t = "\n".join(t.splitlines()[:6]).strip()

        return t

    def _rewrite_to_polite(self, draft: str, user_input: str, system_prompt: str) -> str:
        """
        반말/톤 흔들림이 감지되면, 같은 내용을 존댓말로 1회 재작성합니다.
        """
        rewrite_prompt = (
            "아래 초안을 어르신께 드리는 답변으로 다시 작성하세요.\n"
            "- 반드시 존댓말(하십시오/하세요체)\n"
            "- 1~2문장\n"
            "- 공감 1문장 + 핵심 안내 1문장\n\n"
            f"【사용자 말씀】 {user_input}\n"
            f"【초안】 {draft}\n"
        )

        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": rewrite_prompt},
                ],
                max_completion_tokens=min(350, self.max_completion_tokens),
                temperature=max(0.1, min(self.temperature, 0.4)),
            )
            out = (resp.choices[0].message.content or "").strip()
            return out if out else "네, 어르신. 다시 한 번 말씀해 주시겠어요?"
        except Exception as e:
            print(f"⚠️ 존댓말 재작성 실패: {e}")
            return "죄송합니다, 어르신. 다시 한 번 말씀해 주시겠어요?"
