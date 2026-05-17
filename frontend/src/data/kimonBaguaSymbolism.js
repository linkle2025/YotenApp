/**
 * 奇門遁甲作盤グリッドの洛書位置と八卦象意
 * 配置: 4|9|2 / 3|5|7 / 8|1|6（中宮5は象意なし）
 */
export const KIMON_BAGUA_BY_POSITION = {
  4: {
    title: '南東（巽 そん）',
    zhengxiang: '風',
    person: '長女',
    xiangyi:
      '香り、利益、信用、評判、交際、整う、完成、婚姻、通信、マスコミ、細長い',
  },
  9: {
    title: '南（離 り）',
    zhengxiang: '火',
    person: '中女',
    xiangyi: '文書、印鑑、試験、学問、派手、華やか、別れ、目、学校、書類',
  },
  2: {
    title: '南西（坤 こん）',
    zhengxiang: '地',
    person: '母',
    xiangyi:
      '衣類、田畑、勤勉、誠実、平凡、大衆的、大地、田舎、職場、布、綿毛類',
  },
  3: {
    title: '東（震 しん）',
    zhengxiang: '雷',
    person: '長男',
    xiangyi: '音楽、電気、電話、発展、驚き、動く、音、振動、足',
  },
  7: {
    title: '西（兌 だ）',
    zhengxiang: '沢',
    person: '少女',
    xiangyi: '弁舌、口論、色情、喜び、飲食、貨幣、趣味、口、食べる、娯楽',
  },
  8: {
    title: '北東（艮 ごん）',
    zhengxiang: '山',
    person: '少男',
    xiangyi:
      '変化、改革、貯蓄、銀行、静止、地味、ケチ、後継ぎ、高い、建物、ビル、倉庫',
  },
  1: {
    title: '北（坎 かん）',
    zhengxiang: '水',
    person: '中男',
    xiangyi: '暗い場所、苦労、秘密、低い、肉体関係、セックス',
  },
  6: {
    title: '西北（乾 けん）',
    zhengxiang: '天',
    person: '父',
    xiangyi:
      '目上、寺社、学校、官庁、交通、貴金属、駅、社長、ターミナル、都会、地位高い',
  },
};

/** ポップアップの表示位置（上段マスは下に、下段は上に出す） */
export const BAGUA_POPUP_PLACEMENT = {
  4: 'below',
  9: 'below',
  2: 'below',
  3: 'above',
  7: 'above',
  8: 'above',
  1: 'above',
  6: 'above',
};
