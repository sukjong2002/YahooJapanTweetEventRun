// Gemini API 키 저장 변수
let GEMINI_API_KEY = "";

// 콘텐츠 스크립트에서 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "processWithGemini") {
    console.log('Gemini API 처리 요청:', message.text.substring(0, 50) + '...');
    
    // API 키 가져오기
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (result.geminiApiKey) {
        GEMINI_API_KEY = result.geminiApiKey;
        processWithGemini(message.text)
          .then(result => {
            console.log('Gemini API 처리 성공');
            sendResponse({ success: true, data: result });
          })
          .catch(error => {
            console.error('Gemini API 처리 실패:', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.error('Gemini API 키가 설정되지 않음');
        sendResponse({ success: false, error: "Gemini API 키가 설정되지 않았습니다." });
      }
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});

// Gemini API로 텍스트 처리 (generateContent 사용)
async function processWithGemini(text) {
  // 모델 및 API 엔드포인트 설정
  const MODEL_ID = "gemini-2.0-flash-lite";
  const GENERATE_CONTENT_API = "generateContent";
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${GEMINI_API_KEY}`;
  
  // 요청 데이터 구성
  const requestData = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: text // 트윗 내용
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: "다음은 일본어로 작성된 모집 공고입니다. 아래 규칙을 따라 정보를 추출하고 지정된 출력 형식으로 반환하세요.\n\n규칙\n1. 방 번호 (keyNumber)\n\n5자리 숫자로 구성된 방 번호를 추출하세요.\n\n🔑 이모지 또는 아무런 기호 없이 새로운 줄로 시작할 수 있습니다.\n\n2. 인원 (peopleRn)\n\n\"@n\" 형태로 표현된 숫자를 추출하세요.\n\n예: \"@ 2\" → 2, \"@3\" → 3\n\n3. 주 스탯 (masterStat)\n\n\"主\" 뒤에 나오는 3자리 숫자를 추출하세요.\n\"実効値\"가 포함된 경우 해당 값을 우선적으로 선택하세요.\n\n값이 160을 넘는 경우, 또는 \"実効値\"가 포함된 경우 masterTotalStat을 true로 설정하세요.\n\n\"先頭\"이 포함된 경우 masterTotalStat을 false로 설정하세요.\n\n\"主\" 값이 여러 개 나타날 경우 가장 높은 숫자를 선택하세요.\n\n숫자가 없이 \"スコアアップ\" 라고 적혀 있는 경우 100으로 설정하세요.\n\n4. 모집 스탯 (reqStat)\n\n\"募\" 또는 \"求\" 뒤에 나오는 3자리 숫자를 추출하세요.\n\n\"実効値\"가 포함된 경우 해당 값을 우선적으로 선택하세요.\n\n값이 160을 넘는 경우, 또는 \"実効値\"가 포함된 경우 reqTotalStat을 true로 설정하세요.\n\n\"募\" 또는 \"求\" 값이 여러 개 나타날 경우 가장 높은 숫자를 선택하세요.\n\n숫자가 없이 \"スコアアップ\" 라고 적혀 있는 경우 100으로 설정하세요.\n\n5. 노래 유형 (songType)\n다음 우선순위에 따라 노래 유형을 결정하세요:\n\n高速이 🦐/エビ/えび 앞에 붙어 있는 경우 → \"fast_envy\"\n\nベテラン 포함 → \"sage\"\n\n🦐, エビ, えび 포함 → \"envy\"\n\nロスエン 포함 → \"lostAndFound\"\n\nおまかせ 포함 → \"random\"\n\n6. 시간 조건\n\n\"周回\"이 포함된 경우 unlimited를 true로 설정하세요.\n\n\"n時頃まで\" 또는 \"n時n分まで\" 형태의 시간이 지정된 경우:\nunlimited를 true로 설정하고 시간을 until에 출력하세요.\n예: \"23時45分まで\" → \"23시45분\"\n\n\"n回\" 형태의 판수가 지정된 경우:\nunlimited를 false로 설정하고 판수를 until에 출력하세요.\n예: \"5回\" → \"5판\"\n주의: \"5人\" 또는 あと2 과 같이 횟수가 아닌 다른 값이 나오는 경우를 주의하세요.\n\n7. 규칙 위반 처리\n다음 조건 중 하나라도 만족하지 않으면 빈 배열([])을 반환하세요:\n\n유효한 5자리 keyNumber 존재\n유효한 값 중 하나의 songType 존재\n유효한 모집 조건 reqStat 존재\n\n8: **예시**\n입력:\n🦐 えび エビ周回\\n@ 2\\n\\n11564\\n\\n主…先頭120%\\n募…先頭120%\\n\\n支援さんいます🙇\\n #プロセカ募集  #プロセカ協力\n\n출력:\nkeyNumber: 11564\npeopleRn: 2\nmasterStat: 120\nreqStat: 120\nsongType: envy\nunlimited: true\nmasterTotalStat: false\nreqTotalStat: false\n\n입력:\nベテラン 高速🦐周回　23時45分まで 🗝02292 @33 主 232 (実効値)/ 32.9万 求 215↑ 条件違い解散 SF気にしません スタンプ他部屋と同じ SF後放置◎ いじぺち◎ 集まり悪い場合、条件下げます #プロセカ募集 #プロセカ協力\n\n출력:\nkeyNumber: 02292\npeopleRn: 3\nmasterStat: 232\nreqStat: 215\nsongType: fast_envy\nunlimited: true\nmasterTotalStat: true\nreqTotalStat: true\nuntil: \"23시45분\"\n"
        }
      ]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          tweets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                keyNumber: {
                  type: "string"
                },
                peopleRn: {
                  type: "integer"
                },
                masterStat: {
                  type: "number"
                },
                reqStat: {
                  type: "number"
                },
                songType: {
                  type: "string"
                },
                unlimited: {
                  type: "boolean"
                },
                masterTotalStat: {
                  type: "boolean"
                },
                reqTotalStat: {
                  type: "boolean"
                },
                until: {
                  type: "string"
                }
              },
              required: [
                "keyNumber",
                "masterStat",
                "reqStat",
                "songType",
                "masterTotalStat",
                "reqTotalStat"
              ]
            }
          }
        }
      }
    }
  };
  
  try {
    // API 호출
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP 오류! 상태: ${response.status}, 메시지: ${errorData.error?.message || '알 수 없는 오류'}`);
    }
    
    // generateContent는 단일 응답을 반환하므로 단순히 JSON으로 파싱
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Gemini API 호출 오류:', error);
    throw error;
  }
}
