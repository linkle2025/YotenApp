from django.core.management.base import BaseCommand
from apps.stars.models import Star


class Command(BaseCommand):
    help = '通変星の初期データを投入します'

    def handle(self, *args, **options):
        stars_data = [
            {
                'name': '比肩',
                'reading': 'ひけん',
                'character': '自立した職人\n一本気な個人事業主',
                'talents': '自立心、実行力、忍耐力、集中力、目標達成能力',
                'weaknesses': '頑固、自己中心的、協調性に欠ける、人の意見を聞かない',
                'order': 1,
            },
            {
                'name': '劫財',
                'reading': 'ごうざい',
                'character': 'カリスマ経営者\n野心的なリーダー',
                'talents': '人を惹きつける魅力、リーダーシップ、大きな目標設定、戦略的思考',
                'weaknesses': '浪費家、野心的すぎる、強引、自己顕示欲が強い、人を操ろうとする',
                'order': 2,
            },
            {
                'name': '食神',
                'reading': 'しょくじん',
                'character': 'おおらかな芸術家\n人生の楽天家',
                'talents': '表現力、美的センス、温和な性格、食禄に恵まれる、人を和ませる',
                'weaknesses': '怠け癖、快楽主義、甘え、優柔不断、計画性がない',
                'order': 3,
            },
            {
                'name': '傷官',
                'reading': 'しょうかん',
                'character': '繊細な天才\n完璧主義の革命家',
                'talents': '鋭い感性、天才的な発想、専門技術、美的センス、表現力',
                'weaknesses': '毒舌、批判的、反抗的、プライドが高い、傷つきやすい',
                'order': 4,
            },
            {
                'name': '偏財',
                'reading': 'へんざい',
                'character': '社交的な実業家\n気前の良い人気者',
                'talents': '優れた社交性、人脈構築、商才、サービス精神、情報収集能力',
                'weaknesses': '飽き性、お人好し、浪費家、見栄っ張り、落ち着きがない',
                'order': 5,
            },
            {
                'name': '正財',
                'reading': 'せいざい',
                'character': '誠実な努力家\n信頼できる銀行員',
                'talents': '勤勉、誠実、堅実な金銭感覚、責任感、人からの信用',
                'weaknesses': '臆病、ケチ、冒険しない、面白みに欠ける、融通が利かない',
                'order': 6,
            },
            {
                'name': '偏官',
                'reading': 'へんかん',
                'character': '行動的なリーダー\n情熱の改革者',
                'talents': '行動力、リーダーシップ、正義感、義理人情、困難に立ち向かう力',
                'weaknesses': '短気、攻撃的、無鉄砲、反発心が強い、せっかち',
                'order': 7,
            },
            {
                'name': '正官',
                'reading': 'せいかん',
                'character': '品行方正な優等生\n安定志向の公務員',
                'talents': '責任感、誠実、品行方正、リーダーシップ、社会的な信用',
                'weaknesses': 'ルールに厳格、プライドが高い、面白みに欠ける、融通が利かない',
                'order': 8,
            },
            {
                'name': '偏印',
                'reading': 'へんいん',
                'character': 'ユニークな発想家\n孤独を愛する旅人',
                'talents': '独創性、発想力、直感力、探求心、海外・ITなど特殊な分野',
                'weaknesses': '飽き性、気まぐれ、協調性に欠ける、疑り深い、孤独になりがち',
                'order': 9,
            },
            {
                'name': '印綬',
                'reading': 'いんじゅ',
                'character': '知性派の学者\n慈愛に満ちた母親',
                'talents': '知性、学習能力、探求心、名誉、慈悲深さ、論理的思考',
                'weaknesses': '理屈っぽい、考えすぎて動けない、依存心が強い、プライドが高い',
                'order': 10,
            },
        ]

        # 既存データを削除
        Star.objects.all().delete()
        self.stdout.write(self.style.WARNING('既存の通変星データを削除しました'))

        # 新しいデータを投入
        for data in stars_data:
            star = Star.objects.create(**data)
            self.stdout.write(self.style.SUCCESS(f'✓ {star.name}（{star.reading}）を登録しました'))

        self.stdout.write(self.style.SUCCESS(f'\n合計 {len(stars_data)} 件の通変星データを投入しました'))

