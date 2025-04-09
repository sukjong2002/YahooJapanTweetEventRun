// 이미 처리된 엔트리 추적
const processedEntries = new Set();

// 페이지 로드 시 초기화 함수
function initialize() {
  console.log('Yahoo Japan 실시간 수정 확장 프로그램이 시작되었습니다.');
  console.log('기존 트윗은 무시하고 새 트윗만 처리합니다.');
  
  // 현재 존재하는 모든 트윗 ID를 처리됨으로 표시 (무시하기 위함)
  markExistingTweetsAsProcessed();
  
  // MutationObserver 설정
  setupMutationObserver();
}

// 현재 존재하는 모든 트윗을 무시하기 위해 미리 처리됨으로 표시
function markExistingTweetsAsProcessed() {
  const tweetContainers = document.querySelectorAll(".Tweet_TweetContainer__aezGm");
  
  if (tweetContainers.length > 0) {
    console.log(`${tweetContainers.length}개의 기존 트윗 무시 처리 중...`);
    
    tweetContainers.forEach(container => {
      // 트윗 ID 추출
      const menuElement = container.querySelector('.Tweet_TweetMenu__BjvZa');
      let tweetId = null;
      
      if (menuElement && menuElement.getAttribute('data-cl-params')) {
        const dataParams = menuElement.getAttribute('data-cl-params');
        const twidMatch = dataParams.match(/twid:([0-9]+)/);
        if (twidMatch && twidMatch[1]) {
          tweetId = twidMatch[1];
        }
      }
      
      // 고유 ID가 없으면 임의의 ID 생성
      if (!tweetId) {
        tweetId = `tweet-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      
      // 처리됨으로 표시 (실제 처리는 하지 않음)
      processedEntries.add(tweetId);
    });
    
    console.log(`${tweetContainers.length}개의 기존 트윗이 무시 처리되었습니다.`);
  } else {
    console.log('기존 트윗을 찾을 수 없습니다.');
  }
}

// MutationObserver 설정
function setupMutationObserver() {
  // 변화를 관찰할 대상 요소
  const targetNode = document.getElementById('autosr');
  
  if (!targetNode) {
    console.log('#autosr 요소를 찾을 수 없습니다. 1초 후 다시 시도합니다.');
    setTimeout(setupMutationObserver, 1000);
    return;
  }
  
  // 옵저버 설정
  const config = { childList: true, subtree: true };
  
  // 변화가 감지되었을 때 실행할 콜백함수
  const callback = function(mutationsList, observer) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // 추가된 노드들 확인
        mutation.addedNodes.forEach(node => {
          // 추가된 노드가 Element이고 트윗 컨테이너인 경우
          if (node.nodeType === Node.ELEMENT_NODE && 
              node.classList.contains('Tweet_TweetContainer__aezGm')) {
            console.log('새 트윗 컨테이너 발견:', node);
            processTweetContainer(node);
          }
          // 추가된 노드가 Element이고 트윗 컨테이너를 포함할 수 있는 경우
          else if (node.nodeType === Node.ELEMENT_NODE) {
            const tweetContainers = node.querySelectorAll('.Tweet_TweetContainer__aezGm');
            if (tweetContainers.length > 0) {
              console.log(`추가된 노드 내에서 ${tweetContainers.length}개의 새 트윗 컨테이너 발견`);
              Array.from(tweetContainers).forEach(processTweetContainer);
            }
          }
        });
      }
    }
  };
  
  // 옵저버 생성 및 관찰 시작
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
  console.log('#autosr 요소에 MutationObserver가 설정되었습니다.');
}

// 트윗 컨테이너 처리
function processTweetContainer(container) {
  // 트윗 ID 추출 (data-cl-params에서 twid 값 찾기)
  const menuElement = container.querySelector('.Tweet_TweetMenu__BjvZa');
  let tweetId = null;
  
  if (menuElement && menuElement.getAttribute('data-cl-params')) {
    const dataParams = menuElement.getAttribute('data-cl-params');
    const twidMatch = dataParams.match(/twid:([0-9]+)/);
    if (twidMatch && twidMatch[1]) {
      tweetId = twidMatch[1];
    }
  }
  
  // 고유 ID가 없으면 현재 타임스탬프로 임의의 ID 생성
  if (!tweetId) {
    tweetId = `tweet-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  
  // 이미 처리된 트윗은 건너뛰기
  if (processedEntries.has(tweetId)) {
    console.log(`트윗 ID ${tweetId}는 이미 처리됨 (또는 무시됨)`);
    return;
  }
  
  // 트윗 본문 추출
  const bodyElement = container.querySelector('.Tweet_body__3tH8T');
  if (!bodyElement) {
    console.log(`트윗 ID ${tweetId}에서 본문 요소를 찾을 수 없음`);
    processedEntries.add(tweetId); // 처리된 것으로 표시 (에러도 재시도 방지)
    return;
  }
  
  // a 태그를 제외한 순수 텍스트 추출
  const cleanText = extractTextWithoutLinks(bodyElement);
  
  if (cleanText.trim() === '') {
    console.log(`트윗 ID ${tweetId}의 텍스트가 비어 있음`);
    processedEntries.add(tweetId); // 처리된 것으로 표시
    return;
  }
  
  console.log(`새 트윗 ID ${tweetId} 처리 중, 텍스트: ${cleanText.substring(0, 30)}...`);
  
  // 일단 처리된 것으로 표시 (중복 처리 방지)
  processedEntries.add(tweetId);
  
  // Gemini API로 텍스트 처리
  chrome.runtime.sendMessage(
    { action: "processWithGemini", text: cleanText },
    (response) => {
      if (response && response.success) {
        // 처리 결과로 DOM 업데이트
        updateTweetWithGeminiResult(container, response.data);
        console.log(`트윗 ID ${tweetId} 처리 완료`);
      } else {
        console.error(`트윗 ID ${tweetId} 처리 중 Gemini API 오류:`, response ? response.error : '응답 없음');
      }
    }
  );
}

// a 태그를 제외한 텍스트 추출
function extractTextWithoutLinks(element) {
  // element의 복제본 생성
  const clone = element.cloneNode(true);
  
  // 모든 a 태그 제거
  const links = clone.querySelectorAll('a');
  links.forEach(link => {
    link.remove();
  });
  
  // 남은, 텍스트만 추출
  return clone.textContent.trim();
}

// Gemini 결과로 트윗 업데이트
function updateTweetWithGeminiResult(container, geminiResult) {
    try {
      // 결과 추출
      let parsedResult = null;
      
      if (geminiResult && geminiResult.candidates && 
          geminiResult.candidates[0] && 
          geminiResult.candidates[0].content && 
          geminiResult.candidates[0].content.parts && 
          geminiResult.candidates[0].content.parts[0].text) {
        
        try {
          // JSON 텍스트를 객체로 파싱
          parsedResult = JSON.parse(geminiResult.candidates[0].content.parts[0].text);
        } catch (e) {
          console.error('JSON 파싱 오류:', e);
        }
      }
      
      // 결과가 없거나 트윗 배열이 비어있으면 종료
      if (!parsedResult || !parsedResult.tweets || parsedResult.tweets.length === 0) {
        console.log('유효한 분석 결과가 없습니다.');
        
        // 결과 없음 표시 (선택 사항)
        const resultElement = document.createElement("div");
        resultElement.className = "gemini-result";
        resultElement.textContent = "⚠️ 분석 결과가 없습니다";
        resultElement.style.backgroundColor = "#fff0f0";
        resultElement.style.padding = "10px";
        resultElement.style.margin = "10px 0";
        resultElement.style.border = "1px solid #ffcccc";
        resultElement.style.borderRadius = "5px";
        resultElement.style.fontSize = "14px";
        resultElement.style.color = "#cc0000";
        
        const bodyContainer = container.querySelector('.Tweet_bodyContainer__ud_57');
        if (bodyContainer) {
          bodyContainer.appendChild(resultElement);
        }
        return;
      }
      
      // tweets 배열의 첫 번째 아이템 사용
      const tweetData = parsedResult.tweets[0];
      
      // 이미 결과가 있는지 확인
      const existingResult = container.querySelector('.gemini-result');
      if (existingResult) {
        existingResult.remove(); // 기존 결과 제거
      }
      
      // 새 결과 요소 생성
      const resultElement = document.createElement("div");
      resultElement.className = "gemini-result";
      
      // 노래 유형 매핑
      const songTypeMap = {
        'sage': '사게',
        'envy': '엔비',
        'fast_envy': '고속 엔비',
        'lostAndFound': '로앤파',
        'random': '랜덤'
      };
      
      // 번역된 노래 유형 가져오기
      const songTypeText = songTypeMap[tweetData.songType] || tweetData.songType || '-';

      console.log(tweetData);
      
      
      // 스타일 추가
      const style = document.createElement('style');
      style.textContent = `
        .room-info {
          padding: 15px 20px;
          background-color: #ffffff;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 640px) {
          .room-info {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        .room-header {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 15px;
          background-color: #e8f5fe;
          border-radius: 8px;
          margin-bottom: 5px;
        }
        .room-number {
          font-size: 24px;
          font-weight: 700;
          color: #1a1b1f;
          margin: 0;
        }
        .player-info {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .player-count {
          display: flex;
          gap: 8px;
        }
        .player-badge {
          background-color: #1da1f2;
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 14px;
        }
        .unlimited-badge {
          background-color: #34c759;
          color: white;
          padding: 4px 12px;
          border-radius: 15px;
          font-size: 14px;
          font-weight: 500;
        }
        .stat-container {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .stat-label {
          font-size: 12px;
          color: #657786;
        }
        .stat-value {
          font-size: 16px;
          font-weight: 600;
        }
        .required-stat {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .required-stat-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .total-badge {
          background-color: #34c759;
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }
        .required-stat-value {
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .song-container {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .song-type {
          font-size: 16px;
          font-weight: 600;
        }
        .until-info {
          font-size: 12px;
          color: #657786;
          margin-top: 4px;
        }
      `;
      
      // 디자인 템플릿 생성
      resultElement.innerHTML = `
        ${style.outerHTML}
        <div class="room-info">
          <div class="room-header">
            <h3 class="room-number">🎮
              ${tweetData.keyNumber || '-'}
            </h3>
            <div class="player-info">
              <div class="player-count">
                <span class="player-badge">
                  <span>🧑‍🤝‍🧑${tweetData.peopleRn !== undefined ? tweetData.peopleRn : '-'}</span>
                  <span>명</span>
                </span>
                ${tweetData.unlimited ? '<span class="unlimited-badge">주회</span>' : ''}
              </div>
            </div>
          </div>
          <div class="stat-container">
            <label class="stat-label">방장 스업</label>
            <span class="stat-value">
              ${tweetData.masterStat || '-'}%
              ${tweetData.masterTotalStat ? ' <span class="total-badge">내부치</span>' : ''}
            </span>
          </div>
          <div class="required-stat">
            <div class="required-stat-header">
              <label class="stat-label">요구 스업</label>
              </div>
              <span class="required-stat-value">
              ${tweetData.reqStat || '-'}%
              ${tweetData.reqTotalStat ? '<span class="total-badge">내부치</span>' : ''}
            </span>
          </div>
          <div class="song-container">
            <label class="stat-label">노래</label>
            <span class="song-type">
              ${songTypeText}
            </span>
            ${tweetData.until ? `<div class="until-info">진행: ${tweetData.until}</div>` : ''}
          </div>
        </div>
      `;
      
      // Tweet_bodyContainer__ud_57 요소 뒤에 추가
      const bodyContainer = container.querySelector('.Tweet_bodyContainer__ud_57');
      if (bodyContainer) {
        bodyContainer.appendChild(resultElement);
      } else {
        // 없으면 그냥 원본 요소에 추가
        container.appendChild(resultElement);
      }
      
    } catch (e) {
      console.error('Gemini 결과로 트윗 업데이트 중 오류:', e);
    }
  }
  
  

// 확장 프로그램 초기화
initialize();
