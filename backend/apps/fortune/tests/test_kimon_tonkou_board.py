"""
奇門遁甲作盤の回帰テスト（時家转盘・参照盤と整合したケース）
"""
from django.test import SimpleTestCase

from apps.fortune.calculators import calculate_kimon_tonkou_board


class KimonTonkouGolden20260506Tests(SimpleTestCase):
    """
    2026年5月6日 己卯時・陽遁四局（立夏上元系の局データと整合）
    参照: 丙午年 癸巳月 庚辰日 己卯時、九星・八門・八神の各宮配置
    """

    def test_jimao_yang4_kyusei_hachimon_hasshin(self):
        board = calculate_kimon_tonkou_board(
            '己', '卯', '陽', 4,
            year_stem='丙', month_stem='癸',
            hour_stem='己', hour_branch='卯',
            calculation_type='時盤',
        )
        by_pos = {p['position']: p for p in board['palaces']}

        # 洛書位置 1..9（5は中宮・九星八門は空）
        expected = {
            1: {'kyusei': '蓬', 'hachimon': '死', 'hasshin': '合'},
            2: {'kyusei': '芮', 'hachimon': '傷', 'hasshin': '符'},
            3: {'kyusei': '冲', 'hachimon': '開', 'hasshin': '雀'},
            4: {'kyusei': '輔', 'hachimon': '休', 'hasshin': '地'},
            6: {'kyusei': '心', 'hachimon': '景', 'hasshin': '陰'},
            7: {'kyusei': '柱', 'hachimon': '杜', 'hasshin': '蛇'},
            8: {'kyusei': '任', 'hachimon': '驚', 'hasshin': '陳'},
            9: {'kyusei': '英', 'hachimon': '生', 'hasshin': '天'},
        }
        for pos, exp in expected.items():
            p = by_pos[pos]
            self.assertEqual(p['kyusei'], exp['kyusei'], msg=f'pos{pos} kyusei')
            self.assertEqual(p['hachimon'], exp['hachimon'], msg=f'pos{pos} hachimon')
            self.assertEqual(p['hasshin'], exp['hasshin'], msg=f'pos{pos} hasshin')

        # 時盤・旬首地盤中宮のときは時支飛宮が使われる
        step4 = board['debug']['step4']
        self.assertTrue(step4['debug'].get('branch_fly'), msg='branch_fly should be True for junshu in center 時盤')
        self.assertEqual(step4['debug'].get('branch_fly_number'), 4)

        # 九星: 大直符は坤二に寄せて配置
        step5 = board['debug']['step5']
        self.assertEqual(step5['debug'].get('placement_pos'), 2)


class KimonTonkouBranchFlyBranchTests(SimpleTestCase):
    """旬首地盤が中宮でない時盤では時支飛宮を使わない"""

    def test_bingyin_yang1_no_branch_fly(self):
        board = calculate_kimon_tonkou_board(
            '丙', '寅', '陽', 1,
            year_stem='甲', month_stem='丙',
            hour_stem='丙', hour_branch='寅',
            calculation_type='時盤',
        )
        self.assertFalse(board['debug']['step4']['debug'].get('branch_fly'))
        self.assertIsNone(board['debug']['step4']['debug'].get('branch_fly_number'))
