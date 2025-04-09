(function() {
    console.log('Yahoo Japan 트윗 분석기가 실행되었습니다.');
    
    try {
      const originalFetch = window.fetch;
      
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          
          // Yahoo Japan의 autoscroll API 확인
          if (args[0] && args[0].toString().includes('autoscroll')) {
            console.log('Autoscroll API 호출 감지:', args[0].toString());
            
            const clonedResponse = response.clone();
            
            clonedResponse.json().then(data => {
              console.log('Autoscroll 응답 데이터 수신');
              
              // 데이터를 content script로 전송
              window.postMessage({
                action: "yahooAutoscrollData",
                data: data
              }, "*");
            }).catch(error => {
              console.error('Response 처리 중 오류:', error);
            });
          }
          
          return response;
        } catch (error) {
          console.error('Fetch 오류:', error);
          throw error;
        }
      };
      
      console.log('Fetch 인터셉터가 설정되었습니다.');
    } catch (err) {
      console.error('Fetch 인터셉터 설정 중 오류:', err);
    }
  })();
  