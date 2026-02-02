"""
분석 결과 시각화 모듈
"""

import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import platform


def setup_korean_font():
    """
    한글 폰트 설정
    - Windows: 맑은 고딕
    - Mac: AppleGothic
    - Linux/Colab: 사용자 지정 또는 기본
    """
    system = platform.system()
    
    try:
        if system == 'Windows':
            plt.rcParams['font.family'] = 'Malgun Gothic'
        elif system == 'Darwin':  # Mac
            plt.rcParams['font.family'] = 'AppleGothic'
        else:
            # Linux/Colab - 사용자가 폰트 파일 제공한 경우
            try:
                font_path = './fonts/malgun.ttf'  # 또는 NanumGothic.ttf
                font_name = fm.FontProperties(fname=font_path).get_name()
                fm.fontManager.addfont(font_path)
                plt.rcParams['font.family'] = font_name
            except:
                # 폰트 없으면 기본 (영문 표시됨)
                print("⚠️  한글 폰트 없음 - 영문으로 표시됩니다")
                plt.rcParams['font.family'] = 'DejaVu Sans'
        
        plt.rcParams['axes.unicode_minus'] = False  # 마이너스 깨짐 방지
        
    except Exception as e:
        print(f"⚠️  폰트 설정 오류: {e}")
        print("   기본 폰트로 진행합니다")


def visualize_result(result, save_path=None):
    """
    분석 결과를 막대 그래프로 시각화
    
    Args:
        result: analyzer.analyze() 반환값
        save_path: 저장 경로 (None이면 화면에만 표시)
    """
    # 한글 폰트 설정
    setup_korean_font()
    
    scores = result['scores']

    categories = ['말의\n속도', '발화\n길이', '반응\n속도',
                  '단어\n개수', '어휘\n다양성', '침묵\n패턴']
    values = [scores['speed'], scores['duration'], scores['response'],
              scores['word_count'], scores['vocabulary'], scores['silence']]

    plt.figure(figsize=(12, 6))
    bars = plt.bar(categories, values,
                   color=['#FF6B6B', '#4ECDC4', '#45B7D1',
                          '#FFA07A', '#98D8C8', '#C7CEEA'])

    plt.axhline(y=scores['average'], color='red',
                linestyle='--', linewidth=2,
                label=f'평균: {scores["average"]}점')

    plt.ylim(0, 110)
    plt.ylabel('점수', fontsize=12)
    plt.title('음성 분석 결과', fontsize=14, fontweight='bold')
    plt.legend(fontsize=11)
    plt.grid(axis='y', alpha=0.3)

    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + 2,
                f'{height:.1f}',
                ha='center', va='bottom', fontsize=10, fontweight='bold')

    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📊 그래프 저장 완료: {save_path}")
    
    plt.show()


def print_detailed_report(result):
    """
    상세 분석 리포트 출력 (텍스트)
    """
    features = result['features']
    scores = result['scores']
    
    print("\n" + "="*70)
    print(" "*25 + "📋 상세 분석 리포트")
    print("="*70)
    
    print("\n📝 [음성 인식 결과]")
    print(f"   텍스트: {features['whisper']['text']}")
    print(f"   총 발화 시간: {features['whisper']['duration']:.2f}초")
    print(f"   반응 시간: {features['whisper']['response_time']:.2f}초")
    
    print("\n📊 [언어 특성]")
    print(f"   단어 개수: {features['whisper']['word_count']}개")
    print(f"   말의 속도: {features['whisper']['wpm']:.1f} WPM")
    print(f"   평균 침묵: {features['whisper']['avg_silence']:.2f}초")
    
    print("\n📚 [어휘 분석]")
    print(f"   총 토큰: {features['vocabulary']['total_tokens']}개")
    print(f"   고유 토큰: {features['vocabulary']['unique_tokens']}개")
    print(f"   어휘 다양성(TTR): {features['vocabulary']['ttr']:.3f}")
    
    print("\n🎯 [점수]")
    print(f"   말의 속도:   {scores['speed']:.1f}점")
    print(f"   발화 길이:   {scores['duration']:.1f}점")
    print(f"   반응 속도:   {scores['response']:.1f}점")
    print(f"   단어 개수:   {scores['word_count']:.1f}점")
    print(f"   어휘 다양성: {scores['vocabulary']:.1f}점")
    print(f"   침묵 패턴:   {scores['silence']:.1f}점")
    print(f"\n   ⭐ 평균 점수: {scores['average']}점")
    
    print("="*70)
