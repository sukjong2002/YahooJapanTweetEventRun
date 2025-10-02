document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveApiKey');
    const testButton = document.getElementById('testScript');
    const statusElement = document.getElementById('status');
    const getApiButton = document.getElementById('getApiPage');
    const openYahooRealtimeButton = document.getElementById('openYahooRealtime');


    //API 키 받기 버튼 클릭 시
    getApiButton.addEventListener('click', function() {
      window.open('https://aistudio.google.com/app/apikey?hl=ko', '_blank').focus();
    });
    // 저장된 API 키 로드
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        statusElement.textContent = 'API 키가 설정되었습니다.';
        statusElement.style.display = 'block';
      } else {
        statusElement.style.display = 'none';
      }
    });
    
    // API 키 저장
    saveButton.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({geminiApiKey: apiKey}, function() {
          statusElement.textContent = 'API 키가 저장되었습니다!';
          statusElement.style.display = 'block';
          
          // 현재 활성 탭에 알림
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'apiKeyUpdated'});
            }
          });
        });
      } else {
        statusElement.textContent = '유효한 API 키를 입력해주세요.';
        statusElement.classList.add('error');
        statusElement.style.display = 'block';
      }
    });
    
    // 스크립트 테스트 버튼
    testButton.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'testScript'}, function(response) {
            if (response && response.success) {
              statusElement.textContent = '스크립트 테스트 성공!';
              statusElement.classList.remove('error');
              statusElement.style.display = 'block';
            } else {
              statusElement.textContent = '스크립트 테스트 실패. 콘솔을 확인하세요.';
              statusElement.classList.add('error');
              statusElement.style.display = 'block';
            }
          });
        }
      });
    });

    // 실시간 검색 열기 버튼
    if (openYahooRealtimeButton) {
      openYahooRealtimeButton.addEventListener('click', function() {
        const url = 'https://search.yahoo.co.jp/realtime/search?p=%28%23%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8D%94%E5%8A%9B+OR+%23%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8B%9F%E9%9B%86%29';
        window.open(url, '_blank').focus();
      });
    }
  });
