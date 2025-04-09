document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveApiKey');
    const testButton = document.getElementById('testScript');
    const statusElement = document.getElementById('status');
    const getApiButton = document.getElementById('getApiPage');


    //API 키 받기 버튼 클릭 시
    getApiButton.addEventListener('click', function() {
      window.open('https://aistudio.google.com/app/apikey?hl=ko', '_blank').focus();
    });
    // 저장된 API 키 로드
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        statusElement.textContent = 'API 키가 설정되었습니다.';
      }
    });
    
    // API 키 저장
    saveButton.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({geminiApiKey: apiKey}, function() {
          statusElement.textContent = 'API 키가 저장되었습니다!';
          
          // 현재 활성 탭에 알림
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: "apiKeyUpdated"});
            }
          });
        });
      } else {
        statusElement.textContent = '유효한 API 키를 입력해주세요.';
      }
    });
    
    // 스크립트 테스트 버튼
    testButton.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "testScript"}, function(response) {
            if (response && response.success) {
              statusElement.textContent = '스크립트 테스트 성공!';
            } else {
              statusElement.textContent = '스크립트 테스트 실패. 콘솔을 확인하세요.';
            }
          });
        }
      });
    });
  });
  