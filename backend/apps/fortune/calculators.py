# -*- coding: utf-8 -*-
"""
四柱推命計算ロジック
生年月日時から四柱（年柱・月柱・日柱・時柱）を計算
"""

import json
import csv
import logging
from pathlib import Path
from datetime import datetime, timedelta

# ロガーの設定
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# 十干（天干）
HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

# 十二支（地支）
EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

# 月の節月（立春から始まる）
SOLAR_TERMS = [
    (2, 4),   # 立春（2月4日頃）
    (3, 6),   # 啓蟄（3月6日頃）
    (4, 5),   # 清明（4月5日頃）
    (5, 6),   # 立夏（5月6日頃）
    (6, 6),   # 芒種（6月6日頃）
    (7, 7),   # 小暑（7月7日頃）
    (8, 8),   # 立秋（8月8日頃）
    (9, 8),   # 白露（9月8日頃）
    (10, 8),  # 寒露（10月8日頃）
    (11, 7),  # 立冬（11月7日頃）
    (12, 7),  # 大雪（12月7日頃）
    (1, 6),   # 小寒（1月6日頃）
]

# 都市の経度差による時刻補正（分単位）
# 標準時（東経135度）との経度差を時刻補正として使用
CITY_TIME_OFFSETS = {
    # 北・東日本
    '札幌': 25,
    '青森': 23,
    '盛岡': 25,
    '秋田': 20,
    '仙台': 24,
    '山形': 21,
    '福島': 22,
    '前橋': 16,
    '宇都宮': 20,
    '浦和': 19,
    '水戸': 22,
    '千葉': 20,
    '東京': 19,
    '横浜': 19,
    '静岡': 14,
    '新潟': 16,
    # 中部・近畿
    '長野': 13,
    '甲府': 14,
    '富山': 9,
    '金沢': 7,
    '福井': 5,
    '岐阜': 7,
    '名古屋': 8,
    '津': 6,
    '大津': 3,
    '京都': 3,
    '奈良': 3,
    '和歌山': 1,
    '大阪': 2,
    '神戸': 1,
    '鳥取': -3,
    '岡山': -4,
    # 西日本・九州・沖縄
    '広島': -10,
    '松江': -8,
    '山口': -14,
    '徳島': -2,
    '高松': -9,
    '松山': -9,
    '高知': -6,
    '福岡': -18,
    '大分': -14,
    '佐賀': -19,
    '長崎': -21,
    '熊本': -18,
    '宮崎': -14,
    '鹿児島': -18,
    '那覇': -29,
}

# 均時差による時刻補正（分単位）
# 月ごとの均時差（Equation of Time）
EQUATION_OF_TIME = {
    1: -3,   # 1月
    2: -13,  # 2月
    3: -12,  # 3月
    4: -4,   # 4月
    5: 3,    # 5月
    6: 2,    # 6月
    7: -3,   # 7月
    8: -6,   # 8月
    9: 0,    # 9月
    10: 10,  # 10月
    11: 16,  # 11月
    12: 11,  # 12月
}

# 蔵干（中国式）
# 余気、中気、本気の順
HIDDEN_STEMS_FULL = {
    '子': {'余気': None, '中気': None, '本気': '癸'},
    '丑': {'余気': '癸', '中気': '辛', '本気': '己'},
    '寅': {'余気': '戊', '中気': '丙', '本気': '甲'},
    '卯': {'余気': None, '中気': None, '本気': '乙'},
    '辰': {'余気': '乙', '中気': '癸', '本気': '戊'},
    '巳': {'余気': '戊', '中気': '庚', '本気': '丙'},
    '午': {'余気': None, '中気': '己', '本気': '丁'},
    '未': {'余気': '丁', '中気': '乙', '本気': '己'},
    '申': {'余気': '戊', '中気': '壬', '本気': '庚'},
    '酉': {'余気': None, '中気': None, '本気': '辛'},
    '戌': {'余気': '辛', '中気': '丁', '本気': '戊'},
    '亥': {'余気': None, '中気': '甲', '本気': '壬'},
}

# 蔵干（中国式） - 本気のみ（後方互換性のため）
HIDDEN_STEMS = {
    '子': '癸',
    '丑': '己',
    '寅': '甲',
    '卯': '乙',
    '辰': '戊',
    '巳': '丙',
    '午': '丁',
    '未': '己',
    '申': '庚',
    '酉': '辛',
    '戌': '戊',
    '亥': '壬',
}

# 通変星マッピング
# 日柱の天干を基準として、他の天干に対する通変星を決定
HEAVENLY_STARS = {
    '甲': {'甲': '比肩', '乙': '劫財', '丙': '食神', '丁': '傷官', '戊': '偏財', '己': '正財', '庚': '偏官', '辛': '正官', '壬': '偏印', '癸': '印綬'},
    '乙': {'乙': '比肩', '甲': '劫財', '丁': '食神', '丙': '傷官', '己': '偏財', '戊': '正財', '辛': '偏官', '庚': '正官', '癸': '偏印', '壬': '印綬'},
    '丙': {'丙': '比肩', '丁': '劫財', '戊': '食神', '己': '傷官', '庚': '偏財', '辛': '正財', '壬': '偏官', '癸': '正官', '甲': '偏印', '乙': '印綬'},
    '丁': {'丁': '比肩', '丙': '劫財', '己': '食神', '戊': '傷官', '辛': '偏財', '庚': '正財', '癸': '偏官', '壬': '正官', '乙': '偏印', '甲': '印綬'},
    '戊': {'戊': '比肩', '己': '劫財', '庚': '食神', '辛': '傷官', '壬': '偏財', '癸': '正財', '甲': '偏官', '乙': '正官', '丙': '偏印', '丁': '印綬'},
    '己': {'己': '比肩', '戊': '劫財', '辛': '食神', '庚': '傷官', '癸': '偏財', '壬': '正財', '乙': '偏官', '甲': '正官', '丁': '偏印', '丙': '印綬'},
    '庚': {'庚': '比肩', '辛': '劫財', '壬': '食神', '癸': '傷官', '甲': '偏財', '乙': '正財', '丙': '偏官', '丁': '正官', '戊': '偏印', '己': '印綬'},
    '辛': {'辛': '比肩', '庚': '劫財', '癸': '食神', '壬': '傷官', '乙': '偏財', '甲': '正財', '丁': '偏官', '丙': '正官', '己': '偏印', '戊': '印綬'},
    '壬': {'壬': '比肩', '癸': '劫財', '甲': '食神', '乙': '傷官', '丙': '偏財', '丁': '正財', '戊': '偏官', '己': '正官', '庚': '偏印', '辛': '印綬'},
    '癸': {'癸': '比肩', '壬': '劫財', '乙': '食神', '甲': '傷官', '丁': '偏財', '丙': '正財', '己': '偏官', '戊': '正官', '辛': '偏印', '庚': '印綬'},
}

# 節気データ（グローバル変数として保持）
_SOLAR_TERMS_DATA = None


def load_solar_terms_data():
    """
    節気データをJSONファイルから読み込む
    
    Returns:
        dict: 節気データ
    """
    global _SOLAR_TERMS_DATA
    if _SOLAR_TERMS_DATA is None:
        data_path = Path(__file__).parent / 'data' / 'solar_terms.json'
        with open(data_path, 'r', encoding='utf-8') as f:
            _SOLAR_TERMS_DATA = json.load(f)
    return _SOLAR_TERMS_DATA


# 局数データをキャッシュ
_KYOKUSU_DATA = None

def load_kyokusu_data():
    """
    局数データをCSVファイルから読み込む
    
    Returns:
        dict: 日付（YYYYMMDD形式）をキー、局数データを値とする辞書
    """
    global _KYOKUSU_DATA
    if _KYOKUSU_DATA is not None:
        return _KYOKUSU_DATA
    
    csv_path = Path(__file__).parent / 'data' / 'kyokusu.csv'
    _KYOKUSU_DATA = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row['date']  # YYYYMMDD形式
            
            # day_numberとhour_numberが'3/7'のような形式の場合、最初の値を取得
            day_number_str = row['day_number']
            if '/' in day_number_str:
                day_number_str = day_number_str.split('/')[0]
            
            hour_number_str = row['hour_number']
            if '/' in hour_number_str:
                hour_number_str = hour_number_str.split('/')[0]
            
            # day_yinyangが'陽/陰'のような形式の場合、最初の値を取得
            day_yinyang = row['day_yinyang']
            if '/' in day_yinyang:
                day_yinyang = day_yinyang.split('/')[0]
            
            _KYOKUSU_DATA[date_str] = {
                'day_yinyang': day_yinyang,
                'day_number': int(day_number_str),
                'hour_yinyang': row['hour_yinyang'],
                'hour_number': int(hour_number_str),
            }
    
    return _KYOKUSU_DATA


def get_kyokusu_for_date(year, month, day, calculation_type='日盤'):
    """
    年月日から陰陽と局数を取得
    
    Args:
        year: 年
        month: 月
        day: 日
        calculation_type: '日盤' or '時盤'
    
    Returns:
        tuple: (yin_yang, kyokusu)
    
    Raises:
        ValueError: 対応する局数データが見つからない場合
    """
    date_str = f"{year:04d}{month:02d}{day:02d}"
    kyokusu_data = load_kyokusu_data()
    
    if date_str not in kyokusu_data:
        raise ValueError(f"日付 {year}年{month}月{day}日 に対応する局数データが見つかりません")
    
    data = kyokusu_data[date_str]
    
    if calculation_type == '日盤':
        return data['day_yinyang'], data['day_number']
    else:  # 時盤
        return data['hour_yinyang'], data['hour_number']


# 凶格データの読み込み
_KYOKAKU_DATA = None

def load_kyokaku_data():
    """凶格データをCSVファイルから読み込む"""
    global _KYOKAKU_DATA
    if _KYOKAKU_DATA is not None:
        return _KYOKAKU_DATA
    
    csv_path = Path(__file__).parent / 'data' / 'kyokaku.csv'
    _KYOKAKU_DATA = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            _KYOKAKU_DATA.append({
                'category': row['category'],
                'condition_type': row['condition_type'],
                'condition_value': row['condition_value'],
                'kyokaku_name': row['kyokaku_name'],
                'description': row.get('description', '')
            })
    
    return _KYOKAKU_DATA


def adjust_birth_hour_by_prefecture(birth_hour, birth_minute, city, birth_month):
    """
    都市の経度差と均時差による生時の補正
    
    Args:
        birth_hour: 生時（0-23）
        birth_minute: 生分（0-59）
        city: 都市名
        birth_month: 生月（1-12）
    
    Returns:
        tuple: (補正後の時, 補正後の分, 日付の変更フラグ)
               日付の変更フラグ: -1 (前日), 0 (当日), 1 (翌日)
    """
    # 都市の時刻補正値を取得（デフォルトは東京）
    prefecture_offset = CITY_TIME_OFFSETS.get(city, 19)
    
    # 均時差を取得
    equation_of_time = EQUATION_OF_TIME.get(birth_month, 0)
    
    # 分単位で補正（都道府県の経度差 + 均時差）
    total_minutes = birth_hour * 60 + birth_minute + prefecture_offset + equation_of_time
    
    # 日付変更の判定
    day_change = 0
    if total_minutes < 0:
        # 前日になる場合
        day_change = -1
        total_minutes += 24 * 60
    elif total_minutes >= 24 * 60:
        # 翌日になる場合
        day_change = 1
        total_minutes -= 24 * 60
    
    adjusted_hour = total_minutes // 60
    adjusted_minute = total_minutes % 60
    
    return adjusted_hour, adjusted_minute, day_change


def get_solar_month(year, month, day, hour=0, minute=0):
    """
    節月を取得（正確な節気データを使用）
    
    Args:
        year: 年
        month: 月
        day: 日
        hour: 時（補正後の値）
        minute: 分（補正後の値）
    
    Returns:
        int: 節月（1-12）
        
    Raises:
        ValueError: データ範囲外の年の場合
    """
    logger.info(f"=== 節月判定開始 ===")
    logger.info(f"入力: {year}年{month}月{day}日 {hour}時{minute}分")
    
    if year < 1901 or year > 2040:
        raise ValueError(f"節気データの範囲外です（1901-2040年）。入力年: {year}年")
    
    solar_terms = load_solar_terms_data()
    year_data = solar_terms.get(str(year), {})
    
    # 指定された日時をdatetimeオブジェクトに変換
    target_dt = datetime(year, month, day, hour, minute)
    logger.info(f"対象日時: {target_dt}")
    
    # 12ヶ月分の節気を確認し、どの節月に属するかを判定
    # 節月の順序: 1月=寅月(立春), 2月=卯月(啓蟄), ..., 12月=丑月(小寒)
    solar_month_map = {
        '立春': 1,  # 寅月
        '啓蟄': 2,  # 卯月
        '清明': 3,  # 辰月
        '立夏': 4,  # 巳月
        '芒種': 5,  # 午月
        '小暑': 6,  # 未月
        '立秋': 7,  # 申月
        '白露': 8,  # 酉月
        '寒露': 9,  # 戌月
        '立冬': 10, # 亥月
        '大雪': 11, # 子月
        '小寒': 12, # 丑月
    }
    
    # 節月番号から地支名へのマッピング
    solar_month_to_branch = {
        1: '寅', 2: '卯', 3: '辰', 4: '巳', 5: '午', 6: '未',
        7: '申', 8: '酉', 9: '戌', 10: '亥', 11: '子', 12: '丑'
    }
    
    # 年内の全節気を取得してソート
    terms_list = []
    for m, terms_in_month in year_data.items():
        for term in terms_in_month:
            term_date_str = term['date']
            term_hour = term['hour']
            term_minute = term['minute']
            term_name = term['term']
            
            # 節気の日時をdatetimeオブジェクトに変換
            y, mo, d = map(int, term_date_str.split('-'))
            term_dt = datetime(y, mo, d, term_hour, term_minute)
            
            terms_list.append({
                'datetime': term_dt,
                'term': term_name,
                'solar_month': solar_month_map.get(term_name)
            })
    
    # 日時順にソート
    terms_list.sort(key=lambda x: x['datetime'])
    
    # 対象日時がどの節月に属するかを判定
    # 最後に通過した節気の月が現在の節月
    current_solar_month = 12  # デフォルトは前年12月（丑月）
    last_passed_term = None
    
    logger.info(f"年内の節気数: {len(terms_list)}")
    
    for term_info in terms_list:
        if target_dt >= term_info['datetime']:
            current_solar_month = term_info['solar_month']
            last_passed_term = term_info
            logger.debug(f"  通過した節気: {term_info['term']} ({term_info['datetime']}) → 節月{current_solar_month}")
        else:
            logger.debug(f"  未到達の節気: {term_info['term']} ({term_info['datetime']})")
            break
    
    # 小寒より前の場合、前年の12月（丑月）
    if target_dt < terms_list[0]['datetime']:
        current_solar_month = 12
        logger.info(f"最初の節気より前 → 前年12月（丑月）")
    
    if last_passed_term:
        logger.info(f"最後に通過した節気: {last_passed_term['term']} ({last_passed_term['datetime']})")
    
    branch_name = solar_month_to_branch.get(current_solar_month, '?')
    logger.info(f"判定結果: 節月 = {current_solar_month} ({branch_name}月)")
    logger.info(f"※カレンダーの{month}月 ≠ 節月{current_solar_month}月（{branch_name}月）")
    logger.info(f"=== 節月判定終了 ===\n")
    
    return current_solar_month


def calculate_year_pillar(year, month, day, hour=0, minute=0):
    """
    年柱を計算（立春を基準とする）
    
    Args:
        year: 年
        month: 月
        day: 日
        hour: 時（デフォルト: 0）
        minute: 分（デフォルト: 0）
    
    Returns:
        dict: {'heavenly_stem': str, 'earthly_branch': str}
    """
    # 生年月日時をdatetimeオブジェクトに変換
    birth_dt = datetime(year, month, day, hour, minute)
    
    # 節気データから立春の日時を取得
    solar_terms = load_solar_terms_data()
    
    # 該当年の立春を取得
    year_data = solar_terms.get(str(year), {})
    risshun_dt = None
    
    # 2月の節気（立春）を探す
    if '2' in year_data:
        for term in year_data['2']:
            if term['term'] == '立春':
                term_date_str = term['date']
                term_hour = term['hour']
                term_minute = term['minute']
                y, mo, d = map(int, term_date_str.split('-'))
                risshun_dt = datetime(y, mo, d, term_hour, term_minute)
                break
    
    # 該当年の立春が見つからない場合、前年の立春をチェック（1月初旬など）
    if risshun_dt is None and year > 1901:
        prev_year_data = solar_terms.get(str(year - 1), {})
        if '2' in prev_year_data:
            for term in prev_year_data['2']:
                if term['term'] == '立春':
                    term_date_str = term['date']
                    term_hour = term['hour']
                    term_minute = term['minute']
                    y, mo, d = map(int, term_date_str.split('-'))
                    risshun_dt = datetime(y, mo, d, term_hour, term_minute)
                    break
    
    # 立春の日時が取得できた場合、生年月日時と比較
    if risshun_dt is not None:
        if birth_dt < risshun_dt:
            # 立春より前の場合は前年の年柱を使用
            year_for_calculation = year - 1
        else:
            # 立春以降の場合はその年の年柱を使用
            year_for_calculation = year
    else:
        # 立春が見つからない場合（データ範囲外など）、生年を使用
        year_for_calculation = year
    
    # 基準年（1984年）を甲子年とする
    base_year = 1984
    offset = (year_for_calculation - base_year) % 60
    
    heavenly_stem_index = offset % 10
    earthly_branch_index = offset % 12
    
    return {
        'heavenly_stem': HEAVENLY_STEMS[heavenly_stem_index],
        'earthly_branch': EARTHLY_BRANCHES[earthly_branch_index]
    }


def calculate_month_pillar(year, month, day, hour=0, minute=0):
    """
    月柱を計算（正確な節気データから取得）
    
    Args:
        year: 年
        month: 月
        day: 日
        hour: 時（補正後の値）
        minute: 分（補正後の値）
    
    Returns:
        dict: {'heavenly_stem': str, 'earthly_branch': str}
        
    Raises:
        ValueError: データ範囲外の年の場合
    """
    logger.info(f"=== 月柱計算開始 ===")
    
    if year < 1901 or year > 2040:
        raise ValueError(f"節気データの範囲外です（1901-2040年）。入力年: {year}年")
    
    solar_terms = load_solar_terms_data()
    year_data = solar_terms.get(str(year), {})
    
    # 指定された日時をdatetimeオブジェクトに変換
    target_dt = datetime(year, month, day, hour, minute)
    logger.info(f"対象日時: {target_dt}")
    
    # 年内の全節気を取得してソート
    terms_list = []
    for m, terms_in_month in year_data.items():
        for term in terms_in_month:
            term_date_str = term['date']
            term_hour = term['hour']
            term_minute = term['minute']
            term_name = term['term']
            month_pillar_str = term['month_pillar']
            
            # 節気の日時をdatetimeオブジェクトに変換
            y, mo, d = map(int, term_date_str.split('-'))
            term_dt = datetime(y, mo, d, term_hour, term_minute)
            
            terms_list.append({
                'datetime': term_dt,
                'term': term_name,
                'month_pillar': month_pillar_str
            })
    
    # 日時順にソート
    terms_list.sort(key=lambda x: x['datetime'])
    
    # 対象日時がどの節月に属するかを判定
    # 最後に通過した節気の月柱が現在の月柱
    current_month_pillar = None
    last_passed_term = None
    
    for term_info in terms_list:
        if target_dt >= term_info['datetime']:
            current_month_pillar = term_info['month_pillar']
            last_passed_term = term_info
        else:
            break
    
    # 小寒より前の場合、前年12月の月柱が必要だが、
    # ここでは年の最初の節気より前はエラーとする
    if current_month_pillar is None:
        # 前年の最後の節気（小寒）を取得
        prev_year_data = solar_terms.get(str(year - 1), {})
        if prev_year_data:
            # 前年の12月（小寒）のデータを探す
            for m, terms_in_month in prev_year_data.items():
                for term in terms_in_month:
                    if term['term'] == '小寒':
                        current_month_pillar = term['month_pillar']
                        last_passed_term = {'term': term['term'], 'datetime': f"{year-1}年{term['date']}"}
                        break
    
    if current_month_pillar is None:
        raise ValueError(f"月柱データが見つかりません: {year}年{month}月{day}日")
    
    # 月柱文字列を天干と地支に分割
    month_stem = current_month_pillar[0]
    month_branch = current_month_pillar[1]
    
    if last_passed_term:
        logger.info(f"最後に通過した節気: {last_passed_term['term']} ({last_passed_term['datetime']})")
    logger.info(f"月柱（節気データより）: {month_stem}{month_branch}")
    logger.info(f"=== 月柱計算終了 ===\n")
    
    return {
        'heavenly_stem': month_stem,
        'earthly_branch': month_branch
    }


def calculate_day_pillar(year, month, day):
    """
    日柱を計算（正確な万年暦データを使用）
    
    Args:
        year: 年
        month: 月
        day: 日
    
    Returns:
        dict: {'heavenly_stem': str, 'earthly_branch': str}
        
    Raises:
        ValueError: データ範囲外の年の場合
    """
    if year < 1901 or year > 2040:
        raise ValueError(f"日柱計算の範囲外です（1901-2040年）。入力年: {year}年")
    
    solar_terms = load_solar_terms_data()
    year_data = solar_terms.get(str(year), {})
    
    # 対象日をdatetimeオブジェクトに変換
    target_date = datetime(year, month, day)
    
    # 年内の全節気を取得し、最も近い節気の日干支を基準とする
    closest_term = None
    min_days_diff = float('inf')
    
    for m, terms_in_month in year_data.items():
        for term in terms_in_month:
            term_date_str = term['date']
            y, mo, d = map(int, term_date_str.split('-'))
            term_date = datetime(y, mo, d)
            
            days_diff = (target_date - term_date).days
            
            # 対象日以前で最も近い節気を探す
            if days_diff >= 0 and days_diff < min_days_diff:
                min_days_diff = days_diff
                closest_term = term
    
    # 前年の節気もチェック（1月初旬など）
    if year > 1901:
        prev_year_data = solar_terms.get(str(year - 1), {})
        for m, terms_in_month in prev_year_data.items():
            for term in terms_in_month:
                term_date_str = term['date']
                y, mo, d = map(int, term_date_str.split('-'))
                term_date = datetime(y, mo, d)
                
                days_diff = (target_date - term_date).days
                
                if days_diff >= 0 and days_diff < min_days_diff:
                    min_days_diff = days_diff
                    closest_term = term
    
    if closest_term is None:
        # フォールバック：従来の方法
        base_date = datetime(1900, 1, 1)
        days_diff = (target_date - base_date).days
        offset = days_diff % 60
        heavenly_stem_index = offset % 10
        earthly_branch_index = offset % 12
        return {
            'heavenly_stem': HEAVENLY_STEMS[heavenly_stem_index],
            'earthly_branch': EARTHLY_BRANCHES[earthly_branch_index]
        }
    
    # 基準となる節気の日干支を取得
    base_day_pillar = closest_term['day_pillar']
    base_stem = base_day_pillar[0]
    base_branch = base_day_pillar[1]
    
    base_stem_index = HEAVENLY_STEMS.index(base_stem)
    base_branch_index = EARTHLY_BRANCHES.index(base_branch)
    
    # 日数差分だけ干支を進める
    new_stem_index = (base_stem_index + min_days_diff) % 10
    new_branch_index = (base_branch_index + min_days_diff) % 12
    
    return {
        'heavenly_stem': HEAVENLY_STEMS[new_stem_index],
        'earthly_branch': EARTHLY_BRANCHES[new_branch_index]
    }


def calculate_hour_pillar(year, month, day, hour):
    """
    時柱を計算
    時柱は生時と日柱の天干から計算
    """
    day_pillar = calculate_day_pillar(year, month, day)
    day_stem_index = HEAVENLY_STEMS.index(day_pillar['heavenly_stem'])
    
    # 時柱の地支は生時から決まる（23-1時=子、1-3時=丑、...）
    hour_branch_index = ((hour + 1) // 2) % 12
    
    # 時柱の天干は日柱の天干から決まる（簡易版）
    hour_stem_index = (day_stem_index * 2 + hour_branch_index) % 10
    
    return {
        'heavenly_stem': HEAVENLY_STEMS[hour_stem_index],
        'earthly_branch': EARTHLY_BRANCHES[hour_branch_index]
    }


def get_hidden_stem(earthly_branch):
    """
    地支から蔵干（本気）を取得
    
    Args:
        earthly_branch: 地支
    
    Returns:
        str: 蔵干（本気）
    """
    return HIDDEN_STEMS.get(earthly_branch, '')


def get_hidden_stems_full(earthly_branch):
    """
    地支から蔵干（余気、中気、本気）を取得
    
    Args:
        earthly_branch: 地支
    
    Returns:
        dict: {'余気': str or None, '中気': str or None, '本気': str}
    """
    return HIDDEN_STEMS_FULL.get(earthly_branch, {'余気': None, '中気': None, '本気': ''})


def get_heavenly_star(day_stem, target_stem):
    """
    日柱の天干を基準に、対象の天干の通変星を取得
    
    Args:
        day_stem: 日柱の天干
        target_stem: 通変星を求めたい天干
    
    Returns:
        str: 通変星の名前
    """
    if not day_stem or not target_stem:
        return ''
    return HEAVENLY_STARS.get(day_stem, {}).get(target_stem, '')


# 天干から五行へのマッピング
STEM_TO_ELEMENT = {
    '甲': 'wood', '乙': 'wood',
    '丙': 'fire', '丁': 'fire',
    '戊': 'earth', '己': 'earth',
    '庚': 'metal', '辛': 'metal',
    '壬': 'water', '癸': 'water',
}

# 地支から五行へのマッピング
BRANCH_TO_ELEMENT = {
    '子': 'water', '亥': 'water',
    '寅': 'wood', '卯': 'wood',
    '巳': 'fire', '午': 'fire',
    '申': 'metal', '酉': 'metal',
    '丑': 'earth', '辰': 'earth', '未': 'earth', '戌': 'earth',
}

# 相剋の順序（木→土→水→火→金→木）
KEIKO_CYCLE = ['wood', 'earth', 'water', 'fire', 'metal']


def calculate_kakukyoku(month_branch, year_stem, month_stem, day_stem, hour_stem, hour_unknown=False):
    """
    格局を判定
    
    Args:
        month_branch: 月柱の地支
        year_stem: 年柱の天干
        month_stem: 月柱の天干
        day_stem: 日柱の天干
        hour_stem: 時柱の天干（時間不明の場合はNone）
        hour_unknown: 時間不明フラグ
    
    Returns:
        str: 格局（例：「食神格」「傷官格または偏財格」等）
    
    ロジック:
        1. 月支蔵干の本気が透干している場合 → その通変星が格
        2. 1を満たさず、余気または中気が透干している場合 → その通変星が格
        3. 2で余気と中気の両方が透干している場合 → 両方を返す（◯格または◯格）
        4. 1〜3に当てはまらない場合 → 月支蔵干の本気の通変星が格
    
    透干の定義: 月支蔵干と同じ五行の天干が存在する
    """
    logger.info(f"=== 格局判定開始 ===")
    logger.info(f"月支: {month_branch}")
    
    # 月支の蔵干を取得
    hidden_stems = get_hidden_stems_full(month_branch)
    honki = hidden_stems['本気']
    chuuki = hidden_stems['中気']
    yoki = hidden_stems['余気']
    
    logger.info(f"蔵干 - 本気: {honki}, 中気: {chuuki}, 余気: {yoki}")
    
    # 天干リストを作成（時間不明の場合は時干を含めない）
    stems = [year_stem, month_stem, day_stem]
    if not hour_unknown and hour_stem:
        stems.append(hour_stem)
    
    logger.info(f"判定対象の天干: {stems}")
    
    # 透干判定用のヘルパー関数
    def is_toukan(zoukan_stem):
        """蔵干が透干しているか判定（同じ五行の天干が存在するか）"""
        if not zoukan_stem:
            return False
        zoukan_element = STEM_TO_ELEMENT.get(zoukan_stem)
        if not zoukan_element:
            return False
        
        for stem in stems:
            if stem and STEM_TO_ELEMENT.get(stem) == zoukan_element:
                logger.info(f"  透干検出: 蔵干 {zoukan_stem}({zoukan_element}) - 天干 {stem}({STEM_TO_ELEMENT.get(stem)})")
                return True
        return False
    
    # 通変星から格名に変換
    def get_kaku_name(star_name):
        """通変星から格名を生成（例: 食神 → 食神格）"""
        if not star_name:
            return ''
        # 比肩と劫財は格にならない
        if star_name in ['比肩', '劫財']:
            return ''
        return f"{star_name}格"
    
    # ルール1: 本気が透干している場合
    if is_toukan(honki):
        star = get_heavenly_star(day_stem, honki)
        kaku = get_kaku_name(star)
        if kaku:
            logger.info(f"判定結果: {kaku} (本気 {honki} の通変星 {star})")
            return kaku
    
    # ルール2 & 3: 中気または余気が透干している場合
    yoki_toukan = is_toukan(yoki)
    chuuki_toukan = is_toukan(chuuki)
    
    if yoki_toukan or chuuki_toukan:
        kakus = []
        
        # 両方透干している場合
        if yoki_toukan and chuuki_toukan:
            # 余気の格
            yoki_star = get_heavenly_star(day_stem, yoki)
            yoki_kaku = get_kaku_name(yoki_star)
            if yoki_kaku:
                kakus.append(yoki_kaku)
            
            # 中気の格
            chuuki_star = get_heavenly_star(day_stem, chuuki)
            chuuki_kaku = get_kaku_name(chuuki_star)
            if chuuki_kaku:
                kakus.append(chuuki_kaku)
            
            if kakus:
                result = 'または'.join(kakus)
                logger.info(f"判定結果: {result} (余気と中気の両方が透干)")
                return result
        
        # 余気のみ透干
        elif yoki_toukan:
            yoki_star = get_heavenly_star(day_stem, yoki)
            yoki_kaku = get_kaku_name(yoki_star)
            if yoki_kaku:
                logger.info(f"判定結果: {yoki_kaku} (余気 {yoki} の通変星 {yoki_star})")
                return yoki_kaku
        
        # 中気のみ透干
        elif chuuki_toukan:
            chuuki_star = get_heavenly_star(day_stem, chuuki)
            chuuki_kaku = get_kaku_name(chuuki_star)
            if chuuki_kaku:
                logger.info(f"判定結果: {chuuki_kaku} (中気 {chuuki} の通変星 {chuuki_star})")
                return chuuki_kaku
    
    # ルール4: どれも透干していない場合、本気の通変星が格
    star = get_heavenly_star(day_stem, honki)
    kaku = get_kaku_name(star)
    if kaku:
        logger.info(f"判定結果: {kaku} (透干なし、本気 {honki} の通変星 {star})")
        return kaku
    
    # 比肩・劫財の場合など
    logger.info(f"判定結果: 格なし（本気の通変星が {star}）")
    return ''


def calculate_five_elements_balance(pillars, month_branch, hour_unknown=False):
    """
    五行バランスの点数を計算
    
    Args:
        pillars: dict containing year_pillar, month_pillar, day_pillar, hour_pillar
        month_branch: 月柱の地支（月令）
        hour_unknown: 時間不明かどうか
    
    Returns:
        dict: {
            'scores': {'wood': float, 'fire': float, 'earth': float, 'metal': float, 'water': float},
            'debug_info': [計算過程の詳細情報]
        }
    """
    scores = {'wood': 0.0, 'fire': 0.0, 'earth': 0.0, 'metal': 0.0, 'water': 0.0}
    debug_info = []
    debug_info.append("=== 五行バランス点数計算 ===\n")
    
    # 1. 天干の点数を加算（各10点）
    debug_info.append("【1. 天干の点数（各10点）】")
    pillar_names = ['年柱', '月柱', '日柱', '時柱']
    pillar_keys = ['year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar']
    
    heavenly_stems_in_chart = set()
    
    for i, (name, key) in enumerate(zip(pillar_names, pillar_keys)):
        if hour_unknown and key == 'hour_pillar':
            debug_info.append(f"  {name}: （時間不明のためスキップ）")
            continue
        
        pillar = pillars.get(key)
        if pillar and pillar.get('heavenly_stem'):
            stem = pillar['heavenly_stem']
            element = STEM_TO_ELEMENT.get(stem)
            if element:
                scores[element] += 10
                heavenly_stems_in_chart.add(element)
                debug_info.append(f"  {name}天干: {stem}（{element}） +10点")
    
    debug_info.append(f"  天干に存在する五行: {', '.join(heavenly_stems_in_chart)}\n")
    
    # 2. 蔵干の点数を加算
    debug_info.append("【2. 蔵干の点数】")
    
    # 亥の数をカウント（後で土の余気に加点）
    hai_count = 0
    
    for i, (name, key) in enumerate(zip(pillar_names, pillar_keys)):
        if hour_unknown and key == 'hour_pillar':
            continue
        
        pillar = pillars.get(key)
        if not pillar or not pillar.get('earthly_branch'):
            continue
        
        branch = pillar['earthly_branch']
        hidden_stems = get_hidden_stems_full(branch)
        
        debug_info.append(f"  {name}地支: {branch}")
        
        # 亥をカウント
        if branch == '亥':
            hai_count += 1
        
        # 本気の点数
        honki = hidden_stems['本気']
        if honki:
            element = STEM_TO_ELEMENT.get(honki)
            if element:
                # 子・卯・酉の本気は20点
                if branch in ['子', '卯', '酉']:
                    scores[element] += 20
                    debug_info.append(f"    本気: {honki}（{element}） +20点 ※{branch}は20点")
                # 午の本気（丁）は20点
                elif branch == '午' and honki == '丁':
                    scores[element] += 20
                    debug_info.append(f"    本気: {honki}（{element}） +20点 ※午の丁は20点")
                # その他の本気は10点
                else:
                    scores[element] += 10
                    debug_info.append(f"    本気: {honki}（{element}） +10点")
        
        # 中気の点数
        chuuki = hidden_stems['中気']
        if chuuki:
            element = STEM_TO_ELEMENT.get(chuuki)
            if element:
                # 午の中気（己）は0点
                if branch == '午' and chuuki == '己':
                    debug_info.append(f"    中気: {chuuki}（{element}） +0点 ※午の己は0点")
                # その他の中気は5点
                else:
                    scores[element] += 5
                    debug_info.append(f"    中気: {chuuki}（{element}） +5点")
        
        # 余気の点数
        yoki = hidden_stems['余気']
        if yoki:
            element = STEM_TO_ELEMENT.get(yoki)
            if element:
                scores[element] += 5
                debug_info.append(f"    余気: {yoki}（{element}） +5点")
    
    # 亥による土の加点
    if hai_count > 0:
        scores['earth'] += hai_count * 5
        debug_info.append(f"\n  亥の特殊ルール: 亥が{hai_count}個 → 土に +{hai_count * 5}点\n")
    
    # 3. 月令による倍化
    debug_info.append("【3. 月令による倍化】")
    month_element = BRANCH_TO_ELEMENT.get(month_branch)
    if month_element:
        old_score = scores[month_element]
        scores[month_element] *= 2
        debug_info.append(f"  月支: {month_branch}（{month_element}）")
        debug_info.append(f"  {month_element}を得る → {old_score}点 × 2 = {scores[month_element]}点\n")
    
    # 4. 死令による半減（月支の五行から剋される五行）
    debug_info.append("【4. 死令による半減】")
    if month_element:
        # 相剋の順序で、月令の五行が剋する五行を見つける
        month_index = KEIKO_CYCLE.index(month_element)
        kei_element = KEIKO_CYCLE[(month_index + 1) % 5]  # 次の要素が剋される
        
        old_score = scores[kei_element]
        scores[kei_element] /= 2
        debug_info.append(f"  月支の{month_element}が剋する五行: {kei_element}")
        debug_info.append(f"  {kei_element}は死令 → {old_score}点 ÷ 2 = {scores[kei_element]}点\n")
    
    # 5. 天干に無い五行を半減
    debug_info.append("【5. 天干に無い五行の半減】")
    all_elements = {'wood', 'fire', 'earth', 'metal', 'water'}
    missing_elements = all_elements - heavenly_stems_in_chart
    
    if missing_elements:
        for element in missing_elements:
            old_score = scores[element]
            scores[element] /= 2
            debug_info.append(f"  {element}は天干に無し → {old_score}点 ÷ 2 = {scores[element]}点")
    else:
        debug_info.append("  全ての五行が天干に存在")
    
    debug_info.append("\n【最終結果】")
    for element in ['wood', 'fire', 'earth', 'metal', 'water']:
        debug_info.append(f"  {element}: {scores[element]:.1f}点")
    
    return {
        'scores': scores,
        'debug_info': debug_info
    }


def get_previous_month_solar_term_date(year, month, day):
    """
    生年月日以前で最も近い節入り日を取得（逆運用）
    
    Args:
        year: 年
        month: 月
        day: 日
    
    Returns:
        datetime: 生年月日以前で最も近い節入り日のdatetimeオブジェクト
    """
    solar_terms = load_solar_terms_data()
    birth_date = datetime(year, month, day)
    
    # 年内の全節気を取得
    year_data = solar_terms.get(str(year), {})
    terms_list = []
    for m, terms_in_month in year_data.items():
        for term in terms_in_month:
            term_date_str = term['date']
            term_hour = term['hour']
            term_minute = term['minute']
            y, mo, d = map(int, term_date_str.split('-'))
            term_dt = datetime(y, mo, d, term_hour, term_minute)
            terms_list.append(term_dt)
    
    # 前年の節気もチェック（1月初旬など）
    if year > 1901:
        prev_year_data = solar_terms.get(str(year - 1), {})
        for m, terms_in_month in prev_year_data.items():
            for term in terms_in_month:
                term_date_str = term['date']
                term_hour = term['hour']
                term_minute = term['minute']
                y, mo, d = map(int, term_date_str.split('-'))
                term_dt = datetime(y, mo, d, term_hour, term_minute)
                terms_list.append(term_dt)
    
    # 生年月日以前で最も近い節入り日を返す
    previous_terms = [t for t in terms_list if t < birth_date]
    
    if previous_terms:
        return max(previous_terms)
    else:
        # フォールバック: 前年の小寒
        if year > 1901:
            prev_year_data = solar_terms.get(str(year - 1), {})
            for m, terms_in_month in prev_year_data.items():
                for term in terms_in_month:
                    if term['term'] == '小寒':
                        term_date_str = term['date']
                        term_hour = term['hour']
                        term_minute = term['minute']
                        y, mo, d = map(int, term_date_str.split('-'))
                        return datetime(y, mo, d, term_hour, term_minute)
    
    # 最終フォールバック
    return datetime(year - 1, 1, 6)


def get_next_month_solar_term_date(year, month, day):
    """
    生年月日以降で最も近い節入り日を取得（順運用）
    
    Args:
        year: 年
        month: 月
        day: 日
    
    Returns:
        datetime: 生年月日以降で最も近い節入り日のdatetimeオブジェクト
    """
    solar_terms = load_solar_terms_data()
    birth_date = datetime(year, month, day)
    
    # 年内の全節気を取得
    year_data = solar_terms.get(str(year), {})
    terms_list = []
    for m, terms_in_month in year_data.items():
        for term in terms_in_month:
            term_date_str = term['date']
            term_hour = term['hour']
            term_minute = term['minute']
            y, mo, d = map(int, term_date_str.split('-'))
            term_dt = datetime(y, mo, d, term_hour, term_minute)
            terms_list.append(term_dt)
    
    # 翌年の節気もチェック（12月末など）
    if year < 2040:
        next_year_data = solar_terms.get(str(year + 1), {})
        for m, terms_in_month in next_year_data.items():
            for term in terms_in_month:
                term_date_str = term['date']
                term_hour = term['hour']
                term_minute = term['minute']
                y, mo, d = map(int, term_date_str.split('-'))
                term_dt = datetime(y, mo, d, term_hour, term_minute)
                terms_list.append(term_dt)
    
    # 生年月日以降で最も近い節入り日を返す
    next_terms = [t for t in terms_list if t > birth_date]
    
    if next_terms:
        return min(next_terms)
    else:
        # フォールバック: 翌年の立春
        if year < 2040:
            next_year_data = solar_terms.get(str(year + 1), {})
            for m, terms_in_month in next_year_data.items():
                for term in terms_in_month:
                    if term['term'] == '立春':
                        term_date_str = term['date']
                        term_hour = term['hour']
                        term_minute = term['minute']
                        y, mo, d = map(int, term_date_str.split('-'))
                        return datetime(y, mo, d, term_hour, term_minute)
    
    # 最終フォールバック
    return datetime(year + 1, 2, 4)


def calculate_taiun(birth_year, birth_month, birth_day, year_pillar_heavenly_stem, month_pillar, gender):
    """
    大運を計算
    
    Args:
        birth_year: 生年
        birth_month: 生月
        birth_day: 生日
        year_pillar_heavenly_stem: 年柱天干
        month_pillar: 月柱（{'heavenly_stem': str, 'earthly_branch': str}）
        gender: 性別（'male' or 'female'）
    
    Returns:
        dict: {
            'direction': '順運' or '逆運',
            'ritsuun': int,  # 立運（歳）
            'taiun_list': [
                {
                    'age_start': int,  # 開始年齢
                    'age_end': int,    # 終了年齢
                    'heavenly_stem': str,
                    'earthly_branch': str,
                    'period': str  # 例: "0-8歳"
                },
                ...
            ],
            'debug_info': list  # デバッグ情報
        }
    """
    debug_info = []
    debug_info.append("=== 大運計算開始 ===")
    debug_info.append(f"生年月日: {birth_year}年{birth_month}月{birth_day}日")
    debug_info.append(f"年柱天干: {year_pillar_heavenly_stem}")
    debug_info.append(f"月柱: {month_pillar['heavenly_stem']}{month_pillar['earthly_branch']}")
    debug_info.append(f"性別: {gender}")
    
    # 1. 順運/逆運の判定
    yang_stems = ['甲', '丙', '戊', '庚', '壬']  # 陽干
    is_yang = year_pillar_heavenly_stem in yang_stems
    debug_info.append(f"年干が陽干か: {is_yang} ({year_pillar_heavenly_stem})")
    
    if gender == 'male':
        direction = '順運' if is_yang else '逆運'
    else:  # female
        direction = '逆運' if is_yang else '順運'
    debug_info.append(f"順逆判定: {direction}")
    
    # 2. 立運の計算
    birth_date = datetime(birth_year, birth_month, birth_day)
    
    # 順運/逆運に応じて適切な節入り日を取得
    if direction == '順運':
        # 順運: 生まれた日を起点にして、次に来る節入り日までの日数を数える
        term_date = get_next_month_solar_term_date(birth_year, birth_month, birth_day)
        days_diff = (term_date - birth_date).days
        debug_info.append(f"順運: 次に来る節入り日までの日数を計算")
        debug_info.append(f"次に来る節入り日: {term_date.strftime('%Y年%m月%d日 %H時%M分')}")
    else:
        # 逆運: 生まれた日を起点にして、前に来た節入り日までの日数を数える
        term_date = get_previous_month_solar_term_date(birth_year, birth_month, birth_day)
        # 両端を含めて数えるため、+1する
        days_diff = (birth_date - term_date).days + 1
        debug_info.append(f"逆運: 前に来た節入り日までの日数を計算")
        debug_info.append(f"前に来た節入り日: {term_date.strftime('%Y年%m月%d日 %H時%M分')}")
    
    debug_info.append(f"生年月日: {birth_date.strftime('%Y年%m月%d日')}")
    debug_info.append(f"日数差: {days_diff}日")
    
    # 日数を3で割る
    quotient = days_diff // 3
    remainder = days_diff % 3
    debug_info.append(f"日数 ÷ 3 = {quotient} 余り {remainder}")
    
    if remainder == 1:
        ritsuun = quotient  # 切り捨て
        debug_info.append(f"余り1 → 切り捨て: 立運 = {ritsuun}歳")
    elif remainder == 2:
        ritsuun = quotient + 1  # 切り上げ
        debug_info.append(f"余り2 → 切り上げ: 立運 = {ritsuun}歳")
    else:
        ritsuun = quotient  # 余り0
        debug_info.append(f"余り0: 立運 = {ritsuun}歳")
    
    # 3. 大運の生成
    # 月柱の干支から開始
    current_stem_index = HEAVENLY_STEMS.index(month_pillar['heavenly_stem'])
    current_branch_index = EARTHLY_BRANCHES.index(month_pillar['earthly_branch'])
    debug_info.append(f"月柱の干支インデックス: 天干={current_stem_index}({month_pillar['heavenly_stem']}), 地支={current_branch_index}({month_pillar['earthly_branch']})")
    
    taiun_list = []
    
    debug_info.append(f"\n大運リスト生成開始:")
    
    for i in range(12):  # 12個の大運（120年分）
        if i == 0:
            # 最初の大運は0歳から立運-1歳まで
            age_start = 0
            age_end = ritsuun - 1
            period = f"{age_start}-{age_end}歳"
        else:
            # 2番目以降は立運 + (i-1)*10 から 立運 + (i-1)*10 + 9 まで
            age_start = ritsuun + (i - 1) * 10
            age_end = age_start + 9  # 各大運は10年
            period = f"{age_start}-{age_end}歳"
        
        heavenly_stem = HEAVENLY_STEMS[current_stem_index]
        earthly_branch = EARTHLY_BRANCHES[current_branch_index]
        
        taiun_list.append({
            'age_start': age_start,
            'age_end': age_end,
            'heavenly_stem': heavenly_stem,
            'earthly_branch': earthly_branch,
            'period': period
        })
        
        debug_info.append(f"  大運{i+1}: {period} - {heavenly_stem}{earthly_branch} (天干インデックス={current_stem_index}, 地支インデックス={current_branch_index})")
        
        # 次の干支を計算
        if direction == '順運':
            # 順運: 次の干支
            current_stem_index = (current_stem_index + 1) % 10
            current_branch_index = (current_branch_index + 1) % 12
        else:
            # 逆運: 前の干支
            current_stem_index = (current_stem_index - 1) % 10
            current_branch_index = (current_branch_index - 1) % 12
    
    debug_info.append("=== 大運計算終了 ===\n")
    
    return {
        'direction': direction,
        'ritsuun': ritsuun,
        'taiun_list': taiun_list,
        'debug_info': debug_info
    }


def get_pillar_for_solar_year(solar_year):
    """
    西暦年（立春基準の年）の干支を返す。1984年を甲子とする。
    年運一覧の算出に使用。
    """
    base_year = 1984
    offset = (solar_year - base_year) % 60
    return {
        'heavenly_stem': HEAVENLY_STEMS[offset % 10],
        'earthly_branch': EARTHLY_BRANCHES[offset % 12]
    }


def calculate_fortune(birth_year, birth_month, birth_day, birth_hour, prefecture='東京都', birth_minute=0, hour_unknown=False, gender='male'):
    """
    四柱推命を計算
    
    Args:
        birth_year: 生年
        birth_month: 生月
        birth_day: 生日
        birth_hour: 生時
        prefecture: 生まれた都道府県（デフォルト: 東京都）
        birth_minute: 生分（デフォルト: 0）
        hour_unknown: 時間不明（デフォルト: False）
        gender: 性別（'male' or 'female'、デフォルト: 'male'）
        
    Raises:
        ValueError: 対応年範囲外（1901-2040年）の場合
    """
    logger.info("=" * 60)
    logger.info("四柱推命計算開始")
    logger.info("=" * 60)
    logger.info(f"生年月日時: {birth_year}年{birth_month}月{birth_day}日 {birth_hour}時{birth_minute}分")
    logger.info(f"出生地: {prefecture}")
    
    # データ範囲チェック
    if birth_year < 1901 or birth_year > 2040:
        raise ValueError(f"生年が対応範囲外です（1901-2040年）。入力年: {birth_year}年")
    
    # 都道府県と均時差による時刻補正
    adjusted_hour, adjusted_minute, day_change = adjust_birth_hour_by_prefecture(
        birth_hour, birth_minute, prefecture, birth_month
    )
    
    logger.info(f"時刻補正: {birth_hour}時{birth_minute}分 → {adjusted_hour}時{adjusted_minute}分 (日付変更: {day_change}日)")
    
    # 日付が変更される場合の処理
    if day_change != 0:
        birth_date = datetime(birth_year, birth_month, birth_day)
        adjusted_date = birth_date + timedelta(days=day_change)
        adjusted_year = adjusted_date.year
        adjusted_month = adjusted_date.month
        adjusted_day = adjusted_date.day
        logger.info(f"日付補正: {birth_year}年{birth_month}月{birth_day}日 → {adjusted_year}年{adjusted_month}月{adjusted_day}日")
    else:
        adjusted_year = birth_year
        adjusted_month = birth_month
        adjusted_day = birth_day
    
    logger.info(f"\n補正後の日時: {adjusted_year}年{adjusted_month}月{adjusted_day}日 {adjusted_hour}時{adjusted_minute}分\n")
    
    # 補正後の日時で四柱を計算
    year_pillar = calculate_year_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour, adjusted_minute)
    logger.info(f"年柱: {year_pillar['heavenly_stem']}{year_pillar['earthly_branch']}\n")
    
    month_pillar = calculate_month_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour, adjusted_minute)
    
    day_pillar = calculate_day_pillar(adjusted_year, adjusted_month, adjusted_day)
    logger.info(f"日柱: {day_pillar['heavenly_stem']}{day_pillar['earthly_branch']}\n")
    
    # 時間不明の場合は時柱を計算しない
    if hour_unknown:
        logger.info(f"時柱: （時間不明のため計算なし）\n")
        hour_pillar = None
    else:
        hour_pillar = calculate_hour_pillar(adjusted_year, adjusted_month, adjusted_day, adjusted_hour)
        logger.info(f"時柱: {hour_pillar['heavenly_stem']}{hour_pillar['earthly_branch']}\n")
    
    # 各柱の蔵干を計算
    year_pillar['hidden_stem'] = get_hidden_stem(year_pillar['earthly_branch'])
    year_pillar['hidden_stems_full'] = get_hidden_stems_full(year_pillar['earthly_branch'])
    month_pillar['hidden_stem'] = get_hidden_stem(month_pillar['earthly_branch'])
    month_pillar['hidden_stems_full'] = get_hidden_stems_full(month_pillar['earthly_branch'])
    day_pillar['hidden_stem'] = get_hidden_stem(day_pillar['earthly_branch'])
    day_pillar['hidden_stems_full'] = get_hidden_stems_full(day_pillar['earthly_branch'])
    
    if hour_pillar is not None:
        hour_pillar['hidden_stem'] = get_hidden_stem(hour_pillar['earthly_branch'])
        hour_pillar['hidden_stems_full'] = get_hidden_stems_full(hour_pillar['earthly_branch'])
    
    # 日柱の天干を基準に通変星を計算
    day_stem = day_pillar['heavenly_stem']
    
    # 各柱の天干の通変星
    year_pillar['heavenly_stem_star'] = get_heavenly_star(day_stem, year_pillar['heavenly_stem'])
    month_pillar['heavenly_stem_star'] = get_heavenly_star(day_stem, month_pillar['heavenly_stem'])
    day_pillar['heavenly_stem_star'] = get_heavenly_star(day_stem, day_pillar['heavenly_stem'])
    
    if hour_pillar is not None:
        hour_pillar['heavenly_stem_star'] = get_heavenly_star(day_stem, hour_pillar['heavenly_stem'])
    
    # 各柱の蔵干（本気）の通変星
    year_pillar['hidden_stem_star'] = get_heavenly_star(day_stem, year_pillar['hidden_stem'])
    month_pillar['hidden_stem_star'] = get_heavenly_star(day_stem, month_pillar['hidden_stem'])
    day_pillar['hidden_stem_star'] = get_heavenly_star(day_stem, day_pillar['hidden_stem'])
    
    if hour_pillar is not None:
        hour_pillar['hidden_stem_star'] = get_heavenly_star(day_stem, hour_pillar['hidden_stem'])
    
    # 各柱の蔵干（余気・中気）の通変星
    year_pillar['hidden_stem_secondary_star'] = get_heavenly_star(day_stem, year_pillar['hidden_stems_full']['余気'])
    year_pillar['hidden_stem_tertiary_star'] = get_heavenly_star(day_stem, year_pillar['hidden_stems_full']['中気'])
    month_pillar['hidden_stem_secondary_star'] = get_heavenly_star(day_stem, month_pillar['hidden_stems_full']['余気'])
    month_pillar['hidden_stem_tertiary_star'] = get_heavenly_star(day_stem, month_pillar['hidden_stems_full']['中気'])
    day_pillar['hidden_stem_secondary_star'] = get_heavenly_star(day_stem, day_pillar['hidden_stems_full']['余気'])
    day_pillar['hidden_stem_tertiary_star'] = get_heavenly_star(day_stem, day_pillar['hidden_stems_full']['中気'])
    
    if hour_pillar is not None:
        hour_pillar['hidden_stem_secondary_star'] = get_heavenly_star(day_stem, hour_pillar['hidden_stems_full']['余気'])
        hour_pillar['hidden_stem_tertiary_star'] = get_heavenly_star(day_stem, hour_pillar['hidden_stems_full']['中気'])
    
    # 五行バランスを計算
    five_elements_balance = calculate_five_elements_balance(
        {
            'year_pillar': year_pillar,
            'month_pillar': month_pillar,
            'day_pillar': day_pillar,
            'hour_pillar': hour_pillar,
        },
        month_pillar['earthly_branch'],
        hour_unknown
    )
    
    # 格局を判定
    kakukyoku = calculate_kakukyoku(
        month_pillar['earthly_branch'],
        year_pillar['heavenly_stem'],
        month_pillar['heavenly_stem'],
        day_pillar['heavenly_stem'],
        hour_pillar['heavenly_stem'] if not hour_unknown else None,
        hour_unknown=hour_unknown
    )
    
    # 大運を計算
    taiun = calculate_taiun(
        adjusted_year,
        adjusted_month,
        adjusted_day,
        year_pillar['heavenly_stem'],
        month_pillar,
        gender
    )
    
    # 大運の通変星を計算（日干を基準に）
    for taiun_item in taiun['taiun_list']:
        taiun_item['heavenly_stem_star'] = get_heavenly_star(day_stem, taiun_item['heavenly_stem'])
    
    return {
        'year_pillar': year_pillar,
        'month_pillar': month_pillar,
        'day_pillar': day_pillar,
        'hour_pillar': hour_pillar,
        'five_elements_balance': five_elements_balance,
        'kakukyoku': kakukyoku,
        'taiun': taiun,
    }


# ============================================================================
# 奇門遁甲作盤計算
# ============================================================================

# 局数の位置マッピング（紫白星の定位と同じ）
# 位置: 4 9 2
#       3 5 7
#       8 1 6
KYOKUSU_POSITION = {
    1: 1, 2: 2, 3: 3, 4: 4,
    5: 5, 6: 6, 7: 7, 8: 8, 9: 9
}

# 飛泊の順番は数字の昇順：1→2→3→4→5→6→7→8→9
# 陽局：局数の位置から順方向に進む（例：2局なら 2→3→4→5→6→7→8→9→1）
# 陰局：局数の位置から逆方向に進む（例：7局なら 7→6→5→4→3→2→1→9→8）

# 三奇六儀の順番
SANKI_ROKUGI = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']

# 八門の定位（位置1-9に対応）
# 各位置に対応する八門の定位
HACHIMON_TEII = {
    1: '休',  # 位置1:休
    2: '死',  # 位置2:死
    3: '傷',  # 位置3:傷
    4: '杜',  # 位置4:杜
    5: '',    # 位置5:なし
    6: '開',  # 位置6:開
    7: '驚',  # 位置7:驚
    8: '生',  # 位置8:生
    9: '景'   # 位置9:景
}

# 九星の定位（位置1-9に対応）
KYUSEI_TEII = {
    1: '蓬', 2: '芮', 3: '冲',
    4: '輔', 5: '', 6: '心',
    7: '柱', 8: '任', 9: '英'
}

# 八神の順番
HASSHIN_ORDER = ['符', '蛇', '陰', '合', '陳', '雀', '地', '天']

# 干の数マッピング
KAN_NO_KAZU = {
    '甲': 1, '乙': 2, '丙': 3, '丁': 4, '戊': 5,
    '己': 6, '庚': 7, '辛': 8, '壬': 9, '癸': 10
}

# 時家奇门・八門飛宮用の地支の序数（子=1 … 亥=12）
BRANCH_FLY_NUMBER = {
    '子': 1, '丑': 2, '寅': 3, '卯': 4, '辰': 5, '巳': 6,
    '午': 7, '未': 8, '申': 9, '酉': 10, '戌': 11, '亥': 12,
}

# 中宮（旬首地盤干）の寄宮：坤二宮（洛書位置2）。離九宫（9）は誤り。
KUN_PALACE_POSITION = 2

# 位置から時計回りの順番（位置5を中心に時計回り）
CLOCKWISE_ORDER = [5, 4, 9, 2, 3, 6, 1, 8, 7]

# 各位置から時計回りの順番を定義
# グリッドの配置:
# 4 9 2
# 3 5 7
# 8 1 6
CLOCKWISE_ORDER_FROM_POS = {
    1: [1, 8, 3, 4, 9, 2, 7, 6],  # 旬首が1にある場合
    2: [2, 7, 6, 1, 8, 3, 4, 9],  # 旬首が2にある場合
    3: [3, 4, 9, 2, 7, 6, 1, 8],  # 旬首が3にある場合
    4: [4, 9, 2, 7, 6, 1, 8, 3],  # 旬首が4にある場合
    5: [2, 7, 6, 1, 8, 3, 4, 9],  # 旬首が5にある場合（例外：位置2に配置した上で、位置2から時計回り）
    6: [6, 1, 8, 3, 4, 9, 2, 7],  # 旬首が6にある場合
    7: [7, 6, 1, 8, 3, 4, 9, 2],  # 旬首が7にある場合
    8: [8, 3, 4, 9, 2, 7, 6, 1],  # 旬首が8にある場合
    9: [9, 2, 7, 6, 1, 8, 3, 4],  # 旬首が9にある場合
}

def get_clockwise_order_from_position(start_pos):
    """
    指定された位置から時計回りの順番を取得
    
    Args:
        start_pos: 開始位置（1-9）
    
    Returns:
        list: 開始位置から時計回りの順番
    """
    return CLOCKWISE_ORDER_FROM_POS.get(start_pos, CLOCKWISE_ORDER)

# 反時計回りの順番（位置5を中心に反時計回り）
COUNTER_CLOCKWISE_ORDER = [5, 4, 1, 6, 3, 2, 9, 8, 7]

# 各位置から反時計回りの順番を定義
# グリッドの配置:
# 4 9 2
# 3 5 7
# 8 1 6
COUNTER_CLOCKWISE_ORDER_FROM_POS = {
    1: [1, 6, 7, 2, 9, 4, 3, 8],  # 旬首が1にある場合
    2: [2, 9, 4, 3, 8, 1, 6, 7],  # 旬首が2にある場合
    3: [3, 8, 1, 6, 7, 2, 9, 4],  # 旬首が3にある場合
    4: [4, 3, 8, 1, 6, 7, 2, 9],  # 旬首が4にある場合
    5: [2, 9, 4, 3, 8, 1, 6, 7],  # 旬首が5にある場合（例外：位置2に配置した上で）
    6: [6, 7, 2, 9, 4, 3, 8, 1],  # 旬首が6にある場合
    7: [7, 2, 9, 4, 3, 8, 1, 6],  # 旬首が7にある場合
    8: [8, 1, 6, 7, 2, 9, 4, 3],  # 旬首が8にある場合
    9: [9, 4, 3, 8, 1, 6, 7, 2],  # 旬首が9にある場合
}

def get_counter_clockwise_order_from_position(start_pos):
    """
    指定された位置から反時計回りの順番を取得
    
    Args:
        start_pos: 開始位置（1-9）
    
    Returns:
        list: 開始位置から反時計回りの順番
    """
    return COUNTER_CLOCKWISE_ORDER_FROM_POS.get(start_pos, COUNTER_CLOCKWISE_ORDER)


def get_junshu(day_stem, day_branch):
    """
    旬首を取得
    
    Args:
        day_stem: 日柱または時柱の天干
        day_branch: 日柱または時柱の地支
    
    Returns:
        str: 旬首の天干（戊、己、庚、辛、壬、癸のいずれか）
    """
    # 60干支のリストを作成
    kan_shi_list = []
    for i in range(60):
        stem_idx = i % 10
        branch_idx = i % 12
        kan_shi_list.append((HEAVENLY_STEMS[stem_idx], EARTHLY_BRANCHES[branch_idx]))
    
    # 指定された干支のインデックスを取得
    target_idx = None
    for idx, (stem, branch) in enumerate(kan_shi_list):
        if stem == day_stem and branch == day_branch:
            target_idx = idx
            break
    
    if target_idx is None:
        raise ValueError(f"干支が見つかりません: {day_stem}{day_branch}")
    
    # 旬首を判定（各旬の最初の干支）
    # 甲子（0）→ 戊、甲戌（10）→ 己、甲申（20）→ 庚、甲午（30）→ 辛、甲辰（40）→ 壬、甲寅（50）→ 癸
    jun_idx = target_idx // 10
    
    junshu_map = {
        0: '戊',  # 甲子旬
        1: '己',  # 甲戌旬
        2: '庚',  # 甲申旬
        3: '辛',  # 甲午旬
        4: '壬',  # 甲辰旬
        5: '癸',  # 甲寅旬
    }
    
    return junshu_map[jun_idx]


def place_jiban_kan(kyokusu, yin_yang):
    """
    地盤干を配置
    
    Args:
        kyokusu: 局数（1-9）
        yin_yang: 陰陽（'陽' or '陰'）
    
    Returns:
        dict: 位置（1-9）をキー、地盤干を値とする辞書
    """
    jiban_kan = {}
    
    # 局数の位置を取得（局数と位置は同じ）
    kyokusu_pos = kyokusu
    
    # 飛泊の順番は数字の昇順：1→2→3→4→5→6→7→8→9
    # 陽局：局数の位置から順方向に進む（例：2局なら 2→3→4→5→6→7→8→9→1）
    # 陰局：局数の位置から逆方向に進む（例：7局なら 7→6→5→4→3→2→1→9→8）
    
    # 配置順序を決定
    positions = []
    if yin_yang == '陽':
        # 順方向：局数の位置から順に進む（例：2局なら 2→3→4→5→6→7→8→9→1）
        for i in range(9):
            pos = (kyokusu_pos - 1 + i) % 9 + 1
            positions.append(pos)
    else:
        # 逆方向：局数の位置から逆に進む（例：7局なら 7→6→5→4→3→2→1→9→8）
        for i in range(9):
            pos = (kyokusu_pos - 1 - i) % 9
            pos = pos + 1  # 0-8を1-9に変換
            positions.append(pos)
    
    # 三奇六儀を配置（戊→己→庚→辛→壬→癸→丁→丙→乙）
    for i, kan in enumerate(SANKI_ROKUGI):
        pos = positions[i]
        jiban_kan[pos] = kan
    
    return jiban_kan


def place_tenban_kan(jiban_kan, junshu_stem, day_stem, day_branch):
    """
    天盤干を配置
    
    Args:
        jiban_kan: 地盤干の配置（位置→地盤干）
        junshu_stem: 旬首の天干
        day_stem: 日柱または時柱の天干
        day_branch: 日柱または時柱の地支
    
    Returns:
        tuple: (天盤干の配置辞書, 中宮の干支, 旬首の位置, デバッグ情報)
    """
    tenban_kan = {}
    chugan = None
    junshu_pos = None
    
    # 3-2. ①で調べた干支と同じ地盤干の上に旬首を配置する
    # ①で調べた干支が甲の時は、地盤干の旬首の上に、天盤干として旬首を配置する
    target_kan = day_stem
    target_pos = None
    
    if target_kan == '甲':
        # 甲の場合は、地盤干の旬首の位置に天盤干として旬首を配置する
        for pos, kan in jiban_kan.items():
            if kan == junshu_stem:
                target_pos = pos
                break
        if target_pos is None:
            raise ValueError(f"地盤干に旬首{junshu_stem}が見つかりません")
    else:
        # 甲以外の場合は、①で調べた干支と同じ地盤干の位置を探す
        for pos, kan in jiban_kan.items():
            if kan == target_kan:
                target_pos = pos
                break
        if target_pos is None:
            raise ValueError(f"地盤干に{target_kan}が見つかりません")
    
    # 旬首を配置する位置を決定
    # 中宮（位置5）の場合は位置2に配置（例外処理）
    if target_pos == 5:
        junshu_pos = 2  # 位置2に配置
    else:
        junshu_pos = target_pos
    
    # 旬首を配置
    tenban_kan[junshu_pos] = junshu_stem
    
    # 地盤干の旬首の位置を探す
    junshu_jiban_pos = None
    for pos, kan in jiban_kan.items():
        if kan == junshu_stem:
            junshu_jiban_pos = pos
            break
    
    if junshu_jiban_pos is None:
        raise ValueError(f"地盤干に旬首{junshu_stem}が見つかりません")
    
    # 地盤干の旬首から時計回りに見た順番の地盤干を取得（Aとする）
    # 地盤干の旬首の位置から時計回りの順番を取得
    clock_order = get_clockwise_order_from_position(junshu_jiban_pos)
    
    # 地盤干の旬首から時計回りに見た順番の地盤干を取得（Aとする）
    jiban_kan_clockwise = []
    jiban_kan_clockwise_positions = []  # デバッグ用：位置も記録
    for pos in clock_order:
        if pos in jiban_kan:
            jiban_kan_clockwise.append(jiban_kan[pos])
            jiban_kan_clockwise_positions.append(pos)
    
    # 天盤干の旬首から時計回りに配置する
    # 天盤干の旬首の位置から時計回りの順番を取得
    tenban_clock_order = get_clockwise_order_from_position(junshu_pos)
    
    # 天盤干を配置（旬首から時計回りに、Aの順番で）
    # A: jiban_kan_clockwise = [(戊), 乙, 辛, 己, 癸, 丁, 庚, 壬]
    # 天盤干の旬首（戊）は既に配置済みなので、実質的にはAの2番目（乙）から配置スタート
    # 天盤干の旬首から時計回りに、Aの2番目以降を配置
    tenban_kan_placement = []  # デバッグ用：配置情報を記録
    for i, pos in enumerate(tenban_clock_order):
        if i == 0:
            tenban_kan_placement.append({
                'position': pos,
                'kan': junshu_stem,
                'source': '旬首（既に配置済み）',
                'a_index': 0
            })
            continue  # 旬首は既に配置済み
        # Aの2番目以降を使用（jiban_kan_clockwise[1]から）
        # i=1のとき、jiban_kan_clockwise[1]（乙）を配置
        # i=2のとき、jiban_kan_clockwise[2]（辛）を配置
        # i=3のとき、jiban_kan_clockwise[3]（己）を配置
        # ...
        if i < len(jiban_kan_clockwise):
            kan = jiban_kan_clockwise[i]
            tenban_kan[pos] = kan
            tenban_kan_placement.append({
                'position': pos,
                'kan': kan,
                'source': f'A[{i}]',
                'a_index': i,
                'jiban_pos': jiban_kan_clockwise_positions[i] if i < len(jiban_kan_clockwise_positions) else None
            })
    
    # 位置5の地盤干を複製して、位置2の地盤干と同じ天盤干の隣に配置
    # グリッドの位置2にある地盤干と同じ干が存在している天盤干のグリッドの位置を探す（Bとする）
    jiban_kan_pos2 = jiban_kan.get(2)
    b_pos = None
    jiban_kan_pos5 = jiban_kan.get(5)  # 位置5の地盤干
    existing_tenban = None
    position5_jiban_copied = False
    
    if jiban_kan_pos2:
        # 位置2の地盤干と同じ天盤干が配置されている位置（B）を探す
        for pos, tenban in tenban_kan.items():
            if tenban == jiban_kan_pos2:
                b_pos = pos
                break
        
        # 位置5の地盤干を取得して、Bの位置に横並びで配置する
        if jiban_kan_pos5 and b_pos:
            # Bの位置には既に天盤干が配置されているので、同じ位置に2つの天盤干を配置
            # 既存の天盤干を保持しつつ、位置5の地盤干を複製してBの位置に追加
            # データ構造を変更：Bの位置にはリスト形式で2つの天盤干を保存
            existing_tenban = tenban_kan.get(b_pos)
            if existing_tenban:
                # 既存の天盤干と位置5の地盤干（複製）をリスト形式で保存
                tenban_kan[b_pos] = [existing_tenban, jiban_kan_pos5]
                position5_jiban_copied = True
            else:
                # 既存の天盤干がない場合（通常は発生しない）
                tenban_kan[b_pos] = jiban_kan_pos5
                position5_jiban_copied = True
    
    # 中宮の干支を取得（位置5の地盤干と同じ天盤干の横に表示）
    if target_pos == 5:
        # 中宮の干支は、右上（位置9）の地盤干と同じ天盤干に並べて書く
        # 右上の地盤干を取得
        right_top_jiban = jiban_kan.get(9)
        if right_top_jiban:
            # 右上の地盤干と同じ天盤干を探す
            for pos, tenban in tenban_kan.items():
                if jiban_kan.get(pos) == right_top_jiban:
                    # 中宮の干支を取得
                    chugan = f"{day_stem}{day_branch}"
                    break
    
    # デバッグ情報を準備
    debug_info = {
        'target_kan': target_kan,
        'target_pos': target_pos,
        'junshu_pos': junshu_pos,
        'junshu_jiban_pos': junshu_jiban_pos,
        'jiban_kan_clockwise': jiban_kan_clockwise,  # Aの順番
        'jiban_kan_clockwise_positions': jiban_kan_clockwise_positions,  # Aの順番の位置
        'tenban_clock_order': tenban_clock_order,  # 天盤干の旬首から時計回りの順番
        'tenban_kan_placement': tenban_kan_placement,  # 各位置の配置情報
        'position5_jiban_copy': {  # 位置5の地盤干の複製情報
            'jiban_kan_pos2': jiban_kan_pos2,  # 位置2の地盤干
            'b_pos': b_pos,  # 位置B（位置2の地盤干と同じ天盤干が配置されている位置）
            'jiban_kan_pos5': jiban_kan_pos5,  # 位置5の地盤干
            'existing_tenban': existing_tenban,  # Bの位置に既に配置されていた天盤干
            'position5_jiban_copied': position5_jiban_copied,  # 位置5の地盤干が複製されたかどうか
            'b_pos_tenban_kan_after': tenban_kan.get(b_pos) if b_pos else None  # 複製後のBの位置の天盤干
        }
    }
    
    return tenban_kan, chugan, junshu_pos, debug_info


def place_hachimon(jiban_kan, junshu_stem, day_stem, yin_yang, day_branch=None, calculation_type='時盤'):
    """
    八門を配置
    
    Args:
        jiban_kan: 地盤干の配置
        junshu_stem: 旬首の天干
        day_stem: 日柱または時柱の天干（①で調べた干）
        yin_yang: 陰陽
        day_branch: 日柱または時柱の地支（時盤で旬首が中宮のとき直使飛宮に使用）
        calculation_type: '日盤' or '時盤'
    
    Returns:
        dict: 位置（1-9）をキー、八門を値とする辞書
    """
    hachimon = {}
    
    # 地盤干の旬首の位置を探す
    junshu_pos = None
    for pos, kan in jiban_kan.items():
        if kan == junshu_stem:
            junshu_pos = pos
            break
    
    if junshu_pos is None:
        raise ValueError(f"地盤干に旬首{junshu_stem}が見つかりません")
    
    # 直使を決定（地盤干の旬首の宮の定位の八門）
    chokushi_teii = HACHIMON_TEII.get(junshu_pos)
    if not chokushi_teii or chokushi_teii == '':
        # 中宮（位置5）の場合は、坤二宮（洛書位置2）の八門を定位とする
        if junshu_pos == 5:
            chokushi_teii = HACHIMON_TEII.get(KUN_PALACE_POSITION)
            if not chokushi_teii:
                raise ValueError(f"位置{KUN_PALACE_POSITION}に対応する八門の定位がありません")
        else:
            raise ValueError(f"位置{junshu_pos}に対応する八門の定位がありません")
    
    # 干の数（日干または時干）
    kan_no_kazu = KAN_NO_KAZU.get(day_stem, 1)
    
    # 4-2. 直使を配置する
    # 時盤かつ旬首地盤が中宮のとき：坎一宮の休門を起点に、時支の序数で飛泊して直使宮を求める
    use_branch_fly = (
        junshu_pos == 5
        and calculation_type == '時盤'
        and day_branch
        and day_branch in BRANCH_FLY_NUMBER
    )
    if use_branch_fly:
        chokushi_teii = HACHIMON_TEII.get(1)  # 坎宮・休門
        chokushi_teii_pos = 1
        fly_n = BRANCH_FLY_NUMBER[day_branch]
        if yin_yang == '陽':
            chokushi_pos = (chokushi_teii_pos - 1 + fly_n - 1) % 9 + 1
        else:
            chokushi_pos = (chokushi_teii_pos - 1 - (fly_n - 1)) % 9
            if chokushi_pos < 0:
                chokushi_pos += 9
            chokushi_pos = chokushi_pos + 1
    else:
        # ①で調べた干の「干の数」だけ、直使の定位から飛泊の順番に数えた位置に「直使」を配置する
        if junshu_pos == 5:
            chokushi_teii_pos = KUN_PALACE_POSITION  # 坤二寄宮
        else:
            chokushi_teii_pos = junshu_pos
        
        if yin_yang == '陽':
            chokushi_pos = (chokushi_teii_pos - 1 + kan_no_kazu - 1) % 9 + 1
        else:
            chokushi_pos = (chokushi_teii_pos - 1 - (kan_no_kazu - 1)) % 9
            if chokushi_pos < 0:
                chokushi_pos = chokushi_pos + 9
            chokushi_pos = chokushi_pos + 1
    
    # 直使を配置
    hachimon[chokushi_pos] = chokushi_teii
    
    # 八門の順番（洛書外宮を時計回り：休→生→傷→杜→景→死→驚→開）
    hachimon_order = ['休', '生', '傷', '杜', '景', '死', '驚', '開']
    
    # 直使のインデックスを取得
    chokushi_idx = hachimon_order.index(chokushi_teii)
    
    # 時計回りの順番で配置
    clock_order = get_clockwise_order_from_position(chokushi_pos)
    
    # 各八門を配置
    for i, pos in enumerate(clock_order):
        if i == 0:
            continue  # 直使は既に配置済み
        mon_idx = (chokushi_idx + i) % len(hachimon_order)
        hachimon[pos] = hachimon_order[mon_idx]
    
    # デバッグ情報
    debug_info = {
        'junshu_pos': junshu_pos,
        'chokushi_teii': chokushi_teii,
        'chokushi_teii_pos': chokushi_teii_pos if not use_branch_fly else 1,
        'day_stem': day_stem,
        'kan_no_kazu': kan_no_kazu,
        'branch_fly': use_branch_fly,
        'branch_fly_number': BRANCH_FLY_NUMBER.get(day_branch) if use_branch_fly else None,
        'yin_yang': yin_yang,
        'chokushi_pos': chokushi_pos,
        'hachimon_order': hachimon_order,
        'chokushi_idx': chokushi_idx,
        'clock_order': clock_order
    }
    
    return hachimon, debug_info


def place_kyusei(jiban_kan, day_stem, day_branch, junshu_stem=None):
    """
    九星を配置
    
    Args:
        jiban_kan: 地盤干の配置
        day_stem: 日柱または時柱の天干（①で調べた干）
        day_branch: 日柱または時柱の地支
        junshu_stem: 旬首の天干（甲の場合は必要）
    
    Returns:
        tuple: (九星の配置辞書, デバッグ情報)
    """
    kyusei = {}
    debug_info = {}
    
    # 5-1. 「（大）直符」を決める
    # ①で調べた干支の地盤干旬首の位置を調べ、その位置が定位の九星を大直符とする
    # 地盤干の旬首の位置を探す
    junshu_jiban_pos = None
    if junshu_stem:
        for pos, kan in jiban_kan.items():
            if kan == junshu_stem:
                junshu_jiban_pos = pos
                break
    
    if junshu_jiban_pos is None:
        raise ValueError(f"地盤干に旬首{junshu_stem}が見つかりません")
    
    # 地盤干の旬首の位置の定位の九星を大直符とする
    # 中宮（位置5）の場合は、坤二宮（洛書位置2）の九星を定位とする（離九宫は誤り）
    if junshu_jiban_pos == 5:
        daichokufu_teii = KYUSEI_TEII.get(KUN_PALACE_POSITION)
        if not daichokufu_teii:
            raise ValueError(f"位置{KUN_PALACE_POSITION}に対応する九星の定位がありません")
        debug_info['chugan_kyusei_teii_pos'] = KUN_PALACE_POSITION
    else:
        daichokufu_teii = KYUSEI_TEII.get(junshu_jiban_pos)
        if not daichokufu_teii or daichokufu_teii == '':
            raise ValueError(f"位置{junshu_jiban_pos}に対応する九星の定位がありません")
        debug_info['chugan_kyusei_teii_pos'] = None  # 中宮でない場合は通常通り
    
    # 5-2. ①で調べた干支のある地盤干の宮に「（大）直符」を配置する
    # ①で調べた干支と同じ地盤干の位置を探す
    target_kan = day_stem
    target_pos = None
    
    for pos, kan in jiban_kan.items():
        if kan == target_kan:
            target_pos = pos
            break
    
    # 甲の場合は旬首の干を使用する
    if target_pos is None:
        if target_kan == '甲' and junshu_stem:
            # 甲の場合は、地盤干の旬首の位置を使用
            target_pos = junshu_jiban_pos
        if target_pos is None:
            raise ValueError(f"地盤干に{target_kan}が見つかりません")
    
    # 用事干が中宮（位置5）のときは寄坤二宮に大直符を置き、周回の起点とする
    placement_pos = KUN_PALACE_POSITION if target_pos == 5 else target_pos
    kyusei[placement_pos] = daichokufu_teii
    
    # 5-3. 「（大）直符」から時計回りに順番に九星を配置する
    # 九星の順番（洛書外宮を時計回り：蓬→任→冲→輔→英→芮→柱→心）
    kyusei_order = ['蓬', '任', '冲', '輔', '英', '芮', '柱', '心']
    
    # 大直符のインデックスを取得
    daichokufu_idx = kyusei_order.index(daichokufu_teii)
    
    # 時計回りの順番で配置
    clock_order = get_clockwise_order_from_position(placement_pos)
    
    # 各九星を配置
    for i, pos in enumerate(clock_order):
        if i == 0:
            continue  # 大直符は既に配置済み
        kyusei_idx = (daichokufu_idx + i) % len(kyusei_order)
        kyusei[pos] = kyusei_order[kyusei_idx]
    
    # デバッグ情報（既に一部設定済み）
    debug_info.update({
        'junshu_stem': junshu_stem,  # 旬首の天干
        'junshu_jiban_pos': junshu_jiban_pos,  # 地盤干の旬首の位置
        'daichokufu_teii': daichokufu_teii,  # 大直符
        'day_stem': day_stem,  # ①で調べた干
        'target_kan': target_kan,  # 使用した干（甲の場合は旬首の干）
        'target_pos': target_pos,  # ①で調べた干支のある地盤干の宮の位置
        'placement_pos': placement_pos,  # 大直符を置いた宮（中宮寄坤時は2）
        'kyusei_order': kyusei_order,  # 九星の順番
        'daichokufu_idx': daichokufu_idx,  # 大直符のインデックス
        'clock_order': clock_order  # 時計回りの順番
    })
    
    return kyusei, debug_info


def place_hasshin(jiban_kan, day_stem, day_branch, yin_yang, junshu_stem=None):
    """
    八神を配置
    
    Args:
        jiban_kan: 地盤干の配置
        day_stem: 日柱または時柱の天干（①で調べた干）
        day_branch: 日柱または時柱の地支
        yin_yang: 陰陽（'陽' or '陰'）
        junshu_stem: 旬首の天干（甲の場合は必要）
    
    Returns:
        tuple: (八神の配置辞書, デバッグ情報)
    """
    hasshin = {}
    
    # ①で調べた干支と同じ地盤干の位置を探す
    target_kan = day_stem
    target_pos = None
    
    for pos, kan in jiban_kan.items():
        if kan == target_kan:
            target_pos = pos
            break
    
    # 甲の場合は旬首の干を使用する
    if target_pos is None:
        if target_kan == '甲' and junshu_stem:
            # 甲の場合は、地盤干の旬首の位置を使用
            for pos, kan in jiban_kan.items():
                if kan == junshu_stem:
                    target_pos = pos
                    break
        if target_pos is None:
            raise ValueError(f"地盤干に{target_kan}が見つかりません")
    
    # 6-1. ①で調べた干支がある地盤干の宮に「符」を置く（中宮のときは寄坤二宮）
    placement_pos = KUN_PALACE_POSITION if target_pos == 5 else target_pos
    hasshin[placement_pos] = '符'
    
    # 6-2. 「符」から八神の順番に配置する
    # 陽極の場合は「時計回り」に配置、陰極の場合は「反時計回り」に配置する
    if yin_yang == '陽':
        # 時計回りの順番を取得
        order = get_clockwise_order_from_position(placement_pos)
        order_type = '時計回り'
    else:
        # 反時計回りの順番を取得
        order = get_counter_clockwise_order_from_position(placement_pos)
        order_type = '反時計回り'
    
    # 各八神を配置（符から順番に）
    # 八神の順番：符→蛇→陰→合→陳→雀→地→天
    for i, pos in enumerate(order):
        if i == 0:
            continue  # 符は既に配置済み
        hasshin_idx = i % len(HASSHIN_ORDER)
        hasshin[pos] = HASSHIN_ORDER[hasshin_idx]
    
    # デバッグ情報
    debug_info = {
        'day_stem': day_stem,  # ①で調べた干
        'target_kan': target_kan,  # 使用した干（甲の場合は旬首の干）
        'target_pos': target_pos,  # ①で調べた干支がある地盤干の宮の位置
        'placement_pos': placement_pos,  # 符を置いた宮（中宮寄坤時は2）
        'yin_yang': yin_yang,  # 陰陽
        'hasshin_order': HASSHIN_ORDER,  # 八神の順番
        'order_type': order_type,  # 配置順（時計回り or 反時計回り）
        'order': order  # 配置順の位置
    }
    
    return hasshin, debug_info


def calculate_palace_score(palace):
    """
    各宮の点数を計算
    
    Args:
        palace: 宮のデータ（position, tenban_kan, kyusei, hachimon, jiban_kan, hasshin）
    
    Returns:
        int: 点数
    """
    score = 0
    
    # 八門の点数
    hachimon_scores = {
        '休': 40,
        '生': 40,
        '開': 40,
        '景': 20
    }
    if palace.get('hachimon') and palace['hachimon'] in hachimon_scores:
        score += hachimon_scores[palace['hachimon']]
    
    # 八神の点数
    hasshin_scores = {
        '符': 20,
        '陰': 20,
        '合': 20,
        '地': 20,
        '天': 20
    }
    if palace.get('hasshin') and palace['hasshin'] in hasshin_scores:
        score += hasshin_scores[palace['hasshin']]
    
    # 九星の点数
    kyusei_scores = {
        '任': 10,
        '冲': 10,
        '輔': 10,
        '心': 10
    }
    if palace.get('kyusei') and palace['kyusei'] in kyusei_scores:
        score += kyusei_scores[palace['kyusei']]
    
    # 天盤干の点数
    tenban_kan_scores = {
        '乙': 10,
        '丙': 10,
        '丁': 10
    }
    tenban_kan = palace.get('tenban_kan')
    if tenban_kan:
        # リスト形式の場合（位置5の地盤干が複製されている場合）
        if isinstance(tenban_kan, list):
            for kan in tenban_kan:
                if kan in tenban_kan_scores:
                    score += tenban_kan_scores[kan]
        elif tenban_kan in tenban_kan_scores:
            score += tenban_kan_scores[tenban_kan]
    
    # 地盤干の点数
    jiban_kan_scores = {
        '乙': 10,
        '丙': 10,
        '丁': 10
    }
    jiban_kan = palace.get('jiban_kan')
    if jiban_kan:
        # 括弧で囲まれている場合（旬首）を考慮
        kan = jiban_kan.strip('()')
        if kan in jiban_kan_scores:
            score += jiban_kan_scores[kan]
    
    return score


# 位置マッピング（宮名から位置番号へ）
POSITION_MAPPING = {
    '離宮': 9, '坎宮': 1, '震宮': 3, '兌宮': 7,
    '坤宮': 2, '乾宮': 6, '艮宮': 8, '巽宮': 4
}

def check_gobuuji(day_stem, hour_stem):
    """
    五不遇時の判定
    時干が日干を刻す関係かつ陰陽が同じ場合に成立
    
    Args:
        day_stem: 日干
        hour_stem: 時干
    
    Returns:
        bool: 五不遇時が成立する場合True
    """
    if not day_stem or not hour_stem:
        return False
    
    # 陰陽の判定
    yang_stems = ['甲', '丙', '戊', '庚', '壬']
    yin_stems = ['乙', '丁', '己', '辛', '癸']
    
    day_is_yang = day_stem in yang_stems
    hour_is_yang = hour_stem in yang_stems
    
    # 陰陽が同じでない場合はFalse
    if day_is_yang != hour_is_yang:
        return False
    
    # 時干の五行
    hour_element = STEM_TO_ELEMENT.get(hour_stem)
    # 日干の五行
    day_element = STEM_TO_ELEMENT.get(day_stem)
    
    if not hour_element or not day_element:
        return False
    
    # 相剋の順序で、時干の五行が日干の五行を克するか判定
    # KEIKO_CYCLE = ['wood', 'earth', 'water', 'fire', 'metal']
    # 次の要素が剋される（例: wood → earth を克する）
    hour_index = KEIKO_CYCLE.index(hour_element)
    kei_element = KEIKO_CYCLE[(hour_index + 1) % 5]  # 時干が克する五行
    
    # 時干が日干を克する関係か判定
    return kei_element == day_element


def check_kyokaku(palaces, year_stem, month_stem, day_stem, hour_stem, hour_branch, junshu_stem, calculation_type='時盤'):
    """
    各宮の凶格を判定
    
    Args:
        palaces: 各宮のデータ（リスト）
        year_stem: 年干
        month_stem: 月干
        day_stem: 日干
        hour_stem: 時干
        hour_branch: 時支
        junshu_stem: 旬首の干
        calculation_type: '日盤' or '時盤'
    
    Returns:
        dict: {position: [kyokaku_names], ...}
    """
    kyokaku_data = load_kyokaku_data()
    result = {pos: [] for pos in range(1, 10)}
    
    # プレースホルダーの置換マッピング
    replacements = {
        '(旬首)': junshu_stem,
        '(年干)': year_stem,
        '(月干)': month_stem,
        '(日干)': day_stem,
        '(時干)': hour_stem,
    }
    
    # 時干支（五不遇時の判定用）
    hour_ganzhi = f"{hour_stem}{hour_branch}" if hour_stem and hour_branch else None
    
    for kyokaku in kyokaku_data:
        category = kyokaku['category']
        condition_type = kyokaku['condition_type']
        condition_value = kyokaku['condition_value']
        kyokaku_name = kyokaku['kyokaku_name']
        
        # 五不遇時は時盤のみで判定
        if category == '五不遇時' and calculation_type != '時盤':
            continue
        
        # 各宮をチェック
        for palace in palaces:
            pos = palace['position']
            
            if condition_type == 'tenban_jiban':
                # 天盤地盤の組み合わせ
                # 条件値の形式: "庚:(旬首)" または "(旬首):庚"
                # プレースホルダーを置換
                condition = condition_value
                for placeholder, value in replacements.items():
                    condition = condition.replace(placeholder, value)
                
                # ":"で分割
                parts = condition.split(':')
                if len(parts) == 2:
                    tenban_expected = parts[0].strip()
                    jiban_expected = parts[1].strip()
                    
                    # 天盤干を取得（リスト形式の場合は最初の要素）
                    tenban_kan = palace.get('tenban_kan', '')
                    if isinstance(tenban_kan, list):
                        tenban_kan = tenban_kan[0] if tenban_kan else ''
                    
                    # 地盤干を取得（括弧を除去）
                    jiban_kan = palace.get('jiban_kan', '').strip('()')
                    
                    # 判定
                    if tenban_kan == tenban_expected and jiban_kan == jiban_expected:
                        result[pos].append(kyokaku_name)
            
            elif condition_type == 'hachimon_position':
                # 門迫
                # 条件値の形式: "休門=離宮(九位)"
                if '=' in condition_value:
                    parts = condition_value.split('=')
                    hachimon_expected = parts[0].strip()
                    position_str = parts[1].strip()
                    
                    # 位置を抽出（例: "離宮(九位)" → 9）
                    position = None
                    for palace_name, pos_num in POSITION_MAPPING.items():
                        if palace_name in position_str:
                            position = pos_num
                            break
                    
                    hachimon = palace.get('hachimon', '')
                    if hachimon == hachimon_expected and position == pos:
                        result[pos].append(kyokaku_name)
            
            elif condition_type == 'tenban_position':
                # 三奇入墓、六儀撃刑
                # 条件値の形式: "乙=坤宮(二位)"
                if '=' in condition_value:
                    parts = condition_value.split('=')
                    tenban_expected = parts[0].strip()
                    position_str = parts[1].strip()
                    
                    # 位置を抽出
                    position = None
                    for palace_name, pos_num in POSITION_MAPPING.items():
                        if palace_name in position_str:
                            position = pos_num
                            break
                    
                    # 天盤干を取得（リスト形式の場合は最初の要素）
                    tenban_kan = palace.get('tenban_kan', '')
                    if isinstance(tenban_kan, list):
                        tenban_kan = tenban_kan[0] if tenban_kan else ''
                    
                    if tenban_kan == tenban_expected and position == pos:
                        result[pos].append(kyokaku_name)
            
            elif condition_type == 'day_hour':
                # 五不遇時は別途判定するため、ここではスキップ
                # 五不遇時は各宮ではなく、盤全体の情報として返す
                continue
    
    return result


def calculate_kimon_tonkou_board(day_stem, day_branch, yin_yang, kyokusu, 
                                year_stem=None, month_stem=None, hour_stem=None, hour_branch=None, 
                                calculation_type='時盤'):
    """
    奇門遁甲の作盤を計算
    
    Args:
        day_stem: 日柱または時柱の天干（地盤の場合は時柱、日盤の場合は日柱）
        day_branch: 日柱または時柱の地支
        yin_yang: 陰陽（'陽' or '陰'）
        kyokusu: 局数（1-9）
        year_stem: 年干（凶格判定用、オプション）
        month_stem: 月干（凶格判定用、オプション）
        hour_stem: 時干（凶格判定用、オプション）
        hour_branch: 時支（凶格判定用、オプション）
        calculation_type: '日盤' or '時盤'（凶格判定用、デフォルト: '時盤'）
    
    Returns:
        dict: 作盤結果
            {
                'palaces': [
                    {
                        'position': int,  # 1-9
                        'tenban_kan': str,  # 天盤干
                        'kyusei': str,  # 九星
                        'hachimon': str,  # 八門
                        'jiban_kan': str,  # 地盤干
                        'hasshin': str,  # 八神
                        'chugan': str or None,  # 中宮の干支
                        'kyokaku': list  # 凶格のリスト
                    },
                    ...
                ]
            }
    """
    # ①干支と局数を調べる
    step1_info = {
        'day_stem': day_stem,
        'day_branch': day_branch,
        'kan_shi': f"{day_stem}{day_branch}",
        'yin_yang': yin_yang,
        'kyokusu': kyokusu
    }
    
    # ②地盤干を配置する
    jiban_kan = place_jiban_kan(kyokusu, yin_yang)
    step2_info = {
        'jiban_kan': {str(k): v for k, v in sorted(jiban_kan.items())}
    }
    
    # 旬首を取得
    junshu_stem = get_junshu(day_stem, day_branch)
    step1_info['junshu_stem'] = junshu_stem
    
    # ③天盤干を配置する
    tenban_kan, chugan, junshu_pos, debug_info = place_tenban_kan(jiban_kan, junshu_stem, day_stem, day_branch)
    step3_info = {
        'tenban_kan': {str(k): v for k, v in sorted(tenban_kan.items())},
        'chugan': chugan,
        'junshu_pos': junshu_pos,
        'debug': debug_info  # 詳細なデバッグ情報
    }
    # 天盤干の旬首の位置を保存（括弧で囲むため）
    junshu_tenban_pos = junshu_pos
    
    # ④八門を配置する
    hachimon, debug_info_hachimon = place_hachimon(
        jiban_kan, junshu_stem, day_stem, yin_yang,
        day_branch=day_branch,
        calculation_type=calculation_type,
    )
    step4_info = {
        'hachimon': {str(k): v for k, v in sorted(hachimon.items())},
        'debug': debug_info_hachimon  # 詳細なデバッグ情報
    }
    
    # ⑤九星を配置する
    kyusei, debug_info_kyusei = place_kyusei(jiban_kan, day_stem, day_branch, junshu_stem)
    step5_info = {
        'kyusei': {str(k): v for k, v in sorted(kyusei.items())},
        'debug': debug_info_kyusei  # 詳細なデバッグ情報
    }
    
    # ⑥八神を配置する
    hasshin, debug_info_hasshin = place_hasshin(jiban_kan, day_stem, day_branch, yin_yang, junshu_stem)
    step6_info = {
        'hasshin': {str(k): v for k, v in sorted(hasshin.items())},
        'debug': debug_info_hasshin  # 詳細なデバッグ情報
    }
    
    # 結果を整理
    palaces = []
    for pos in range(1, 10):
        # 天盤干を取得（リスト形式の場合はそのまま、文字列の場合はそのまま）
        tenban_kan_value = tenban_kan.get(pos, '')
        palace = {
            'position': pos,
            'tenban_kan': tenban_kan_value,  # リストまたは文字列
            'kyusei': kyusei.get(pos, ''),
            'hachimon': hachimon.get(pos, ''),
            'jiban_kan': jiban_kan.get(pos, ''),
            'hasshin': hasshin.get(pos, ''),
            'chugan': chugan if pos == 9 else None  # 中宮の干支は右上（位置9）に表示
        }
        # 中央（位置5）を除く8つの宮に点数を計算
        if pos != 5:
            palace['score'] = calculate_palace_score(palace)
        else:
            palace['score'] = None  # 中央は点数なし
        palaces.append(palace)
    
    # 旬首の地盤干の位置を取得
    junshu_jiban_pos = None
    for pos, kan in jiban_kan.items():
        if kan == junshu_stem:
            junshu_jiban_pos = pos
            break
    
    # 凶格判定
    # 日盤の場合: 年干、月干があれば一部の凶格を判定可能（五不遇時は除く）
    # 時盤の場合: 年干、月干、時干、時支があればすべての凶格を判定可能
    if year_stem and month_stem:
        # 時干、時支が提供されていない場合はNoneを渡す（日盤の場合）
        kyokaku_result = check_kyokaku(
            palaces, year_stem, month_stem, day_stem, 
            hour_stem, hour_branch, junshu_stem, calculation_type
        )
        # 各宮に凶格を追加
        for palace in palaces:
            pos = palace['position']
            palace['kyokaku'] = kyokaku_result.get(pos, [])
        
        # 五不遇時の判定（時盤のみ、時干が必要）
        if calculation_type == '時盤' and hour_stem:
            gobuuji = check_gobuuji(day_stem, hour_stem)
    else:
        # 凶格判定に必要な情報が不足している場合は空のリスト
        for palace in palaces:
            palace['kyokaku'] = []
        gobuuji = False
    
    return {
        'palaces': palaces,
        'junshu_jiban_pos': junshu_jiban_pos,  # 旬首の地盤干の位置
        'junshu_tenban_pos': junshu_tenban_pos,  # 天盤干の旬首の位置
        'gobuuji': gobuuji,  # 五不遇時のフラグ
        'debug': {
            'step1': step1_info,  # ①干支と局数を調べる
            'step2': step2_info,  # ②地盤干を配置する
            'step3': step3_info,  # ③天盤干を配置する
            'step4': step4_info,  # ④八門を配置する
            'step5': step5_info,  # ⑤九星を配置する
            'step6': step6_info,  # ⑥八神を配置する
        }
    }