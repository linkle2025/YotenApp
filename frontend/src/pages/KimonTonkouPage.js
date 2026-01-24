import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fortuneService } from '../services/fortuneService';
import { PREFECTURES } from '../utils/constants';
import './KimonTonkouPage.css';

const KimonTonkouPage = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  
  // 現在の日時を取得
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentDay = String(now.getDate()).padStart(2, '0');
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  
  // 日盤の状態
  const [nichibanDate, setNichibanDate] = useState(`${currentYear}-${currentMonth}-${currentDay}`);
  const [nichibanYinYang, setNichibanYinYang] = useState('');
  const [nichibanKyokusu, setNichibanKyokusu] = useState('');
  const [nichibanResult, setNichibanResult] = useState(null);
  const [nichibanLoading, setNichibanLoading] = useState(false);
  const [nichibanError, setNichibanError] = useState('');
  
  // 時盤の状態
  const [jibanDate, setJibanDate] = useState(`${currentYear}-${currentMonth}-${currentDay}`);
  const [jibanTime, setJibanTime] = useState(`${currentHour}:${currentMinute}`);
  const [jibanPrefecture, setJibanPrefecture] = useState(
    user?.profile?.residence_prefecture || '東京'
  );
  const [jibanYinYang, setJibanYinYang] = useState('');
  const [jibanKyokusu, setJibanKyokusu] = useState('');
  const [jibanResult, setJibanResult] = useState(null);
  const [jibanLoading, setJibanLoading] = useState(false);
  const [jibanError, setJibanError] = useState('');

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
    // ユーザーのお住いの県をデフォルト値として設定
    if (user?.profile?.residence_prefecture) {
      setJibanPrefecture(user.profile.residence_prefecture);
    }
  }, [isAdmin, navigate, user]);

  const handleNichibanSubmit = async (e) => {
    e.preventDefault();
    setNichibanLoading(true);
    setNichibanError('');
    setNichibanResult(null);

    try {
      const [year, month, day] = nichibanDate.split('-').map(Number);
      const requestData = {
        type: '日盤',
        year,
        month,
        day,
      };
      // 陰陽と局数が指定されている場合は追加
      if (nichibanYinYang) {
        requestData.yin_yang = nichibanYinYang;
      }
      if (nichibanKyokusu) {
        requestData.kyokusu = parseInt(nichibanKyokusu);
      }
      const result = await fortuneService.calculateKimonTonkou(requestData);
      setNichibanResult(result);
    } catch (err) {
      console.error('日盤計算エラー:', err);
      const errorData = err.response?.data;
      if (errorData?.error) {
        // 詳細なエラーメッセージを表示
        setNichibanError(`エラー: ${errorData.error}`);
      } else if (err.message) {
        setNichibanError(`エラー: ${err.message}`);
      } else {
        setNichibanError('日盤の計算に失敗しました。');
      }
    } finally {
      setNichibanLoading(false);
    }
  };

  const handleJibanSubmit = async (e) => {
    e.preventDefault();
    setJibanLoading(true);
    setJibanError('');
    setJibanResult(null);

    try {
      const [year, month, day] = jibanDate.split('-').map(Number);
      const [hour, minute] = jibanTime.split(':').map(Number);
      const requestData = {
        type: '時盤',
        year,
        month,
        day,
        hour,
        minute,
        prefecture: jibanPrefecture,
      };
      // 陰陽と局数が指定されている場合は追加
      if (jibanYinYang) {
        requestData.yin_yang = jibanYinYang;
      }
      if (jibanKyokusu) {
        requestData.kyokusu = parseInt(jibanKyokusu);
      }
      const result = await fortuneService.calculateKimonTonkou(requestData);
      setJibanResult(result);
    } catch (err) {
      console.error('時盤計算エラー:', err);
      const errorData = err.response?.data;
      if (errorData?.error) {
        // 詳細なエラーメッセージを表示
        setJibanError(`エラー: ${errorData.error}`);
      } else if (err.message) {
        setJibanError(`エラー: ${err.message}`);
      } else {
        setJibanError('時盤の計算に失敗しました。');
      }
    } finally {
      setJibanLoading(false);
    }
  };

  // デバッグ情報を表示するコンポーネント
  const DebugDisplay = ({ debug }) => {
    if (!debug) return null;

    // 位置順にソートして表示用の配列を作成
    const formatPosition = (data) => {
      const gridOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
      return gridOrder.map(pos => {
        const key = String(pos);
        return data[key] || '';
      });
    };

    return (
      <div className="debug-section">
        <h4>デバッグ情報</h4>
        
        {/* ①干支と局数を調べる */}
        <div className="debug-step">
          <h5>①干支と局数を調べる</h5>
          <div className="debug-content">
            <p>干支: {debug.step1?.kan_shi}</p>
            <p>天干: {debug.step1?.day_stem}</p>
            <p>地支: {debug.step1?.day_branch}</p>
            <p>旬首: {debug.step1?.junshu_stem}</p>
            <p>陰陽: {debug.step1?.yin_yang}</p>
            <p>局数: {debug.step1?.kyokusu}</p>
          </div>
        </div>

        {/* ②地盤干を配置する */}
        <div className="debug-step">
          <h5>②地盤干を配置する</h5>
          <div className="debug-content">
            <div className="debug-grid">
              {formatPosition(debug.step2?.jiban_kan || {}).map((kan, idx) => (
                <div key={idx} className="debug-cell">
                  {kan}
                </div>
              ))}
            </div>
            <div className="debug-detail">
              <p>詳細:</p>
              <pre>{JSON.stringify(debug.step2?.jiban_kan, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* ③天盤干を配置する */}
        <div className="debug-step">
          <h5>③天盤干を配置する</h5>
          <div className="debug-content">
            <div className="debug-grid">
              {formatPosition(debug.step3?.tenban_kan || {}).map((kan, idx) => (
                <div key={idx} className="debug-cell">
                  {kan}
                </div>
              ))}
            </div>
            <div className="debug-detail">
              <h6>基本情報</h6>
              <p>①で調べた干支の天干: {debug.step3?.debug?.target_kan}</p>
              <p>①で調べた干支と同じ地盤干の位置: {debug.step3?.debug?.target_pos}</p>
              <p>天盤干の旬首の位置: {debug.step3?.junshu_pos}</p>
              <p>地盤干の旬首の位置: {debug.step3?.debug?.junshu_jiban_pos}</p>
              {debug.step3?.chugan && <p>中宮の干支: {debug.step3.chugan}</p>}
              
              <h6>地盤干の旬首から時計回りの順番（A）</h6>
              <p>
                {debug.step3?.debug?.jiban_kan_clockwise?.map((kan, idx) => (
                  <span key={idx} style={{ marginRight: '0.5rem' }}>
                    {idx === 0 ? `(${kan})` : kan}
                    {idx < debug.step3.debug.jiban_kan_clockwise.length - 1 && '→'}
                  </span>
                ))}
              </p>
              <p>位置: {debug.step3?.debug?.jiban_kan_clockwise_positions?.join(' → ')}</p>
              
              <h6>天盤干の旬首から時計回りの順番</h6>
              <p>位置: {debug.step3?.debug?.tenban_clock_order?.join(' → ')}</p>
              
              <h6>各位置の配置情報</h6>
              <table className="debug-table">
                <thead>
                  <tr>
                    <th>位置</th>
                    <th>天盤干</th>
                    <th>出典</th>
                    <th>Aのインデックス</th>
                    <th>地盤干の位置</th>
                  </tr>
                </thead>
                <tbody>
                  {debug.step3?.debug?.tenban_kan_placement?.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.position}</td>
                      <td>{item.kan}</td>
                      <td>{item.source}</td>
                      <td>{item.a_index}</td>
                      <td>{item.jiban_pos || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <h6>位置5の地盤干の複製情報</h6>
              {debug.step3?.debug?.position5_jiban_copy && (
                <div>
                  <p>位置2の地盤干: {debug.step3.debug.position5_jiban_copy.jiban_kan_pos2 || 'なし'}</p>
                  <p>位置B（位置2の地盤干と同じ天盤干が配置されている位置）: {debug.step3.debug.position5_jiban_copy.b_pos || 'なし'}</p>
                  <p>位置5の地盤干: {debug.step3.debug.position5_jiban_copy.jiban_kan_pos5 || 'なし'}</p>
                  <p>Bの位置に既に配置されていた天盤干: {debug.step3.debug.position5_jiban_copy.existing_tenban || 'なし'}</p>
                  <p>位置5の地盤干が複製されたか: {debug.step3.debug.position5_jiban_copy.position5_jiban_copied ? 'はい' : 'いいえ'}</p>
                  <p>複製後のBの位置の天盤干: {
                    Array.isArray(debug.step3.debug.position5_jiban_copy.b_pos_tenban_kan_after) 
                      ? `${debug.step3.debug.position5_jiban_copy.b_pos_tenban_kan_after[0]}${debug.step3.debug.position5_jiban_copy.b_pos_tenban_kan_after[1]}` 
                      : (debug.step3.debug.position5_jiban_copy.b_pos_tenban_kan_after || 'なし')
                  }</p>
                </div>
              )}
              
              <h6>詳細（JSON）</h6>
              <pre>{JSON.stringify(debug.step3, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* ④八門を配置する */}
        <div className="debug-step">
          <h5>④八門を配置する</h5>
          <div className="debug-content">
            <div className="debug-grid">
              {formatPosition(debug.step4?.hachimon || {}).map((mon, idx) => (
                <div key={idx} className="debug-cell">
                  {mon}
                </div>
              ))}
            </div>
            <div className="debug-detail">
              <h6>基本情報</h6>
              <p>地盤干の旬首の位置: {debug.step4?.debug?.junshu_pos || 'なし'}</p>
              <p>直使: {debug.step4?.debug?.chokushi_teii || 'なし'}</p>
              <p>直使の定位の位置: {debug.step4?.debug?.chokushi_teii_pos || 'なし'}</p>
              <p>①で調べた干: {debug.step4?.debug?.day_stem || 'なし'}</p>
              <p>干の数: {debug.step4?.debug?.kan_no_kazu || 'なし'}</p>
              <p>陰陽: {debug.step4?.debug?.yin_yang || 'なし'}</p>
              <p>直使を配置した位置: {debug.step4?.debug?.chokushi_pos || 'なし'}</p>
              
              <h6>計算過程</h6>
              <p>定位の位置: {debug.step4?.debug?.chokushi_teii_pos || 'なし'}</p>
              <p>干の数: {debug.step4?.debug?.kan_no_kazu || 'なし'}</p>
              <p>陰陽: {debug.step4?.debug?.yin_yang || 'なし'}</p>
              {debug.step4?.debug?.yin_yang === '陽' ? (
                <p>計算式: ({debug.step4?.debug?.chokushi_teii_pos} - 1 + {debug.step4?.debug?.kan_no_kazu} - 1) % 9 + 1 = {debug.step4?.debug?.chokushi_pos}</p>
              ) : (
                <p>計算式: ({debug.step4?.debug?.chokushi_teii_pos} - 1 - ({debug.step4?.debug?.kan_no_kazu} - 1)) % 9 + 1 = {debug.step4?.debug?.chokushi_pos}</p>
              )}
              
              <h6>八門の順番</h6>
              <p>{debug.step4?.debug?.hachimon_order?.join(' → ')}</p>
              <p>直使のインデックス: {debug.step4?.debug?.chokushi_idx}</p>
              
              <h6>時計回りの順番</h6>
              <p>位置: {debug.step4?.debug?.clock_order?.join(' → ')}</p>
              
              <h6>詳細（JSON）</h6>
              <pre>{JSON.stringify(debug.step4, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* ⑤九星を配置する */}
        <div className="debug-step">
          <h5>⑤九星を配置する</h5>
          <div className="debug-content">
            <div className="debug-grid">
              {formatPosition(debug.step5?.kyusei || {}).map((sei, idx) => (
                <div key={idx} className="debug-cell">
                  {sei}
                </div>
              ))}
            </div>
            <div className="debug-detail">
              <h6>基本情報</h6>
              <p>旬首の天干: {debug.step5?.debug?.junshu_stem || 'なし'}</p>
              <p>地盤干の旬首の位置: {debug.step5?.debug?.junshu_jiban_pos || 'なし'}</p>
              <p>大直符: {debug.step5?.debug?.daichokufu_teii || 'なし'}</p>
              <p>①で調べた干: {debug.step5?.debug?.day_stem || 'なし'}</p>
              <p>使用した干: {debug.step5?.debug?.target_kan || 'なし'}</p>
              <p>①で調べた干支のある地盤干の宮の位置: {debug.step5?.debug?.target_pos || 'なし'}</p>
              
              <h6>九星の順番</h6>
              <p>{debug.step5?.debug?.kyusei_order?.join(' → ')}</p>
              <p>大直符のインデックス: {debug.step5?.debug?.daichokufu_idx}</p>
              
              <h6>時計回りの順番</h6>
              <p>位置: {debug.step5?.debug?.clock_order?.join(' → ')}</p>
              
              <h6>詳細（JSON）</h6>
              <pre>{JSON.stringify(debug.step5, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* ⑥八神を配置する */}
        <div className="debug-step">
          <h5>⑥八神を配置する</h5>
          <div className="debug-content">
            <div className="debug-grid">
              {formatPosition(debug.step6?.hasshin || {}).map((shin, idx) => (
                <div key={idx} className="debug-cell">
                  {shin}
                </div>
              ))}
            </div>
            <div className="debug-detail">
              <h6>基本情報</h6>
              <p>①で調べた干: {debug.step6?.debug?.day_stem || 'なし'}</p>
              <p>使用した干: {debug.step6?.debug?.target_kan || 'なし'}</p>
              <p>①で調べた干支がある地盤干の宮の位置: {debug.step6?.debug?.target_pos || 'なし'}</p>
              <p>陰陽: {debug.step6?.debug?.yin_yang || 'なし'}</p>
              
              <h6>八神の順番</h6>
              <p>{debug.step6?.debug?.hasshin_order?.join(' → ')}</p>
              
              <h6>配置順</h6>
              <p>配置方法: {debug.step6?.debug?.order_type || 'なし'}</p>
              <p>位置: {debug.step6?.debug?.order?.join(' → ')}</p>
              
              <h6>詳細（JSON）</h6>
              <pre>{JSON.stringify(debug.step6, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 作盤結果を表示するコンポーネント
  const BoardDisplay = ({ board, dayPillar, yinYang, kyokusu }) => {
    if (!board || !board.palaces) {
      return null;
    }

    // 位置順にソート（1-9）
    const sortedPalaces = [...board.palaces].sort((a, b) => a.position - b.position);
    
    // 旬首の地盤干を取得（地盤干が旬首の場合は括弧で囲む）
    const getJibanKanDisplay = (palace) => {
      if (!palace.jiban_kan) return '';
      // 旬首の地盤干の位置と一致する場合は括弧で囲む
      if (board.junshu_jiban_pos && palace.position === board.junshu_jiban_pos) {
        return `(${palace.jiban_kan})`;
      }
      return palace.jiban_kan;
    };

    // 天盤干の旬首を取得（天盤干が旬首の場合は括弧で囲む）
    const getTenbanKanDisplay = (palace) => {
      if (!palace.tenban_kan) return '';
      
      // 天盤干がリスト形式の場合（位置5の天盤干がBの位置に横並びで配置されている場合）
      if (Array.isArray(palace.tenban_kan)) {
        const [first, second] = palace.tenban_kan;
        let display = '';
        if (board.junshu_tenban_pos && palace.position === board.junshu_tenban_pos) {
          display = `(${first})`;
        } else {
          display = first;
        }
        // 2つ目の天盤干を横並びで表示
        display += second;
        return display;
      }
      
      // 通常の文字列形式の場合
      // 天盤干の旬首の位置と一致する場合は括弧で囲む
      if (board.junshu_tenban_pos && palace.position === board.junshu_tenban_pos) {
        return `(${palace.tenban_kan})`;
      }
      return palace.tenban_kan;
    };

    // グリッドの配置（位置順）
    // 4 | 9 | 2
    // 3 | 5 | 7
    // 8 | 1 | 6
    const gridOrder = [4, 9, 2, 3, 5, 7, 8, 1, 6];
    const orderedPalaces = gridOrder.map(pos => 
      sortedPalaces.find(p => p.position === pos)
    );

    return (
      <div className="board-container">
        <div className="board-grid">
          {orderedPalaces.map((palace, index) => {
            if (!palace) return <div key={index} className="board-cell"></div>;
            
            return (
              <div key={palace.position} className="board-cell">
                <div className="board-cell-content">
                  {/* 1行目: 天盤干（左）と九星（右） */}
                  <div className="board-cell-row board-cell-row-top">
                    <span className="board-tenban-kan">{getTenbanKanDisplay(palace)}</span>
                    {palace.chugan && (
                      <span className="board-chugan">{palace.chugan}</span>
                    )}
                    <span className="board-kyusei">{palace.kyusei || ''}</span>
                  </div>
                  {/* 2行目: 八門（中央） */}
                  <div className="board-cell-row board-cell-row-center">
                    <span className="board-hachimon">{palace.hachimon || ''}</span>
                  </div>
                  {/* 3行目: 地盤干（左）と八神（右） */}
                  <div className="board-cell-row board-cell-row-bottom">
                    <span className="board-jiban-kan">{getJibanKanDisplay(palace)}</span>
                    <span className="board-hasshin">{palace.hasshin || ''}</span>
                  </div>
                  {/* 凶格の表示 */}
                  {palace.kyokaku && palace.kyokaku.length > 0 && (
                    <div className="board-kyokaku">
                      {palace.kyokaku.map((kyokaku, idx) => (
                        <span key={idx} className="kyokaku-item">{kyokaku}</span>
                      ))}
                    </div>
                  )}
                  {palace.score !== undefined && palace.score !== null && (
                    <div className="board-score-overlay">{palace.score}点</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="kimon-tonkou-container">
      <h1>奇門遁甲</h1>

      {/* 時盤の作成 */}
      <section className="kimon-section">
        <h2>時盤の作成</h2>
        <form onSubmit={handleJibanSubmit} className="kimon-form">
          <div className="form-group">
            <label htmlFor="jiban-date">年月日</label>
            <input
              type="date"
              id="jiban-date"
              value={jibanDate}
              onChange={(e) => setJibanDate(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="jiban-time">時間</label>
            <input
              type="time"
              id="jiban-time"
              value={jibanTime}
              onChange={(e) => setJibanTime(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="jiban-prefecture">場所（都市）</label>
            <select
              id="jiban-prefecture"
              value={jibanPrefecture}
              onChange={(e) => setJibanPrefecture(e.target.value)}
              required
              className="form-input"
            >
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="jiban-yinyang">陰陽（任意）</label>
            <select
              id="jiban-yinyang"
              value={jibanYinYang}
              onChange={(e) => setJibanYinYang(e.target.value)}
              className="form-input"
            >
              <option value="">自動（日付から決定）</option>
              <option value="陽">陽</option>
              <option value="陰">陰</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="jiban-kyokusu">局数（任意）</label>
            <select
              id="jiban-kyokusu"
              value={jibanKyokusu}
              onChange={(e) => setJibanKyokusu(e.target.value)}
              className="form-input"
            >
              <option value="">自動（日付から決定）</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
          <p className="form-note">※ 陰陽・局数を指定しない場合は、日付から自動的に決定されます</p>
          <button type="submit" disabled={jibanLoading} className="submit-button">
            {jibanLoading ? '計算中...' : '送信'}
          </button>
        </form>

        {jibanError && (
          <div className="error-message">{jibanError}</div>
        )}

        {jibanResult && (
          <div className="result-section">
            <h3>表示結果</h3>
            <p className="result-datetime">
              作盤日時：{jibanResult.datetime_str}
              {jibanResult.natural_time_str && (
                <span className="natural-time">
                  <br />自然時：{jibanResult.natural_time_str}
                </span>
              )}
            </p>
            <p className="result-pillars">
              干支：{jibanResult.pillars_str}　{jibanResult.yin_yang}{jibanResult.kyokusu}局
              {jibanResult.gobuuji && <span className="gobuuji-mark">【五不遇時】</span>}
            </p>
            {jibanResult.board && (
              <>
                <BoardDisplay 
                  board={jibanResult.board}
                  dayPillar={jibanResult.hour_pillar}
                  yinYang={jibanResult.yin_yang}
                  kyokusu={jibanResult.kyokusu}
                />
                {jibanResult.board.debug && (
                  <DebugDisplay debug={jibanResult.board.debug} />
                )}
              </>
            )}
          </div>
        )}
      </section>




      {/* 日盤の作成 */}
      <section className="kimon-section">
        <h2>日盤の作成</h2>
        <form onSubmit={handleNichibanSubmit} className="kimon-form">
          <div className="form-group">
            <label htmlFor="nichiban-date">年月日</label>
            <input
              type="date"
              id="nichiban-date"
              value={nichibanDate}
              onChange={(e) => setNichibanDate(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="nichiban-yinyang">陰陽（任意）</label>
            <select
              id="nichiban-yinyang"
              value={nichibanYinYang}
              onChange={(e) => setNichibanYinYang(e.target.value)}
              className="form-input"
            >
              <option value="">自動（日付から決定）</option>
              <option value="陽">陽</option>
              <option value="陰">陰</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="nichiban-kyokusu">局数（任意）</label>
            <select
              id="nichiban-kyokusu"
              value={nichibanKyokusu}
              onChange={(e) => setNichibanKyokusu(e.target.value)}
              className="form-input"
            >
              <option value="">自動（日付から決定）</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
          <p className="form-note">※ 陰陽・局数を指定しない場合は、日付から自動的に決定されます</p>
          <button type="submit" disabled={nichibanLoading} className="submit-button">
            {nichibanLoading ? '計算中...' : '送信'}
          </button>
        </form>

        {nichibanError && (
          <div className="error-message">{nichibanError}</div>
        )}

        {nichibanResult && (
          <div className="result-section">
            <h3>表示結果</h3>
            <p className="result-datetime">作盤日時：{nichibanResult.datetime_str}</p>
            <p className="result-pillars">
              干支：{nichibanResult.pillars_str}　{nichibanResult.yin_yang}{nichibanResult.kyokusu}局
              {nichibanResult.gobuuji && <span className="gobuuji-mark">【五不遇時】</span>}
            </p>
            {nichibanResult.board && (
              <>
                <BoardDisplay 
                  board={nichibanResult.board}
                  dayPillar={nichibanResult.day_pillar}
                  yinYang={nichibanResult.yin_yang}
                  kyokusu={nichibanResult.kyokusu}
                />
                {nichibanResult.board.debug && (
                  <DebugDisplay debug={nichibanResult.board.debug} />
                )}
              </>
            )}
          </div>
        )}
      </section>

    </div>
  );
};

export default KimonTonkouPage;

