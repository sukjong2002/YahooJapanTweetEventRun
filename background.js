// Gemini API 키 저장 변수
let GEMINI_API_KEY = "";

// API 설정 상수들을 별도로 분리
const GEMINI_CONFIG = {
  MODEL_ID: "gemini-2.0-flash-lite",
  GENERATE_CONTENT_API: "generateContent",
  
  // 시스템 인스트럭션 (재사용 가능하도록 분리)
  SYSTEM_INSTRUCTION: {
    parts: [
      {
        text: 'あなたは日本語の募集ツイート解析アシスタントです。入力テキストから以下の項目を正確に抽出し、指定のJSONスキーマに厳密に従って返してください。返答は必ずJSONのみで、説明文を含めないでください。\n\n抽出ルール: \n1) keyNumber (部屋番号)\n- 5桁の数字 (先頭0許可)。🗝, 鍵, 🔑 の直後、または単独行に出現することが多い。\n- 5桁以外の数字列は無視。\n\n2) peopleRn (人数)\n- "@n" / "＠n" / "@ n" / "＠ n" の数値nを抽出 (1〜4程度が多い)。\n- 人数に関係ない"5人", "あと2" などは除外。\n\n3) masterStat (主ステ) と masterTotalStat\n- キーワード: 主, 先頭, ホスト。直後または同一行の数値(例: 120, 160, 232)。\n- "実効値"があればその数値を優先。\n- 数値>160 または "実効値" を含む → masterTotalStat=true。\n- "先頭"のみ明示 → masterTotalStat=false。\n- "スコアアップ"or"星4"のみ → 100 とみなす。複数値は最大値を採用。\n\n4) reqStat (募集/条件) と reqTotalStat\n- キーワード: 募, 求, 条件。直後(同一行)の数値を抽出。\n- ルールは masterStat と同様。複数値は最大値。\n\n5) songType\n- 優先順位で一意に決定: \n  a. "高速" が 🦐/エビ/えび の直前にある → fast_envy\n  b. "ベテラン" を含む → sage\n  c. 🦐, エビ, えび を含む → envy\n  d. ロスエン/ロスエンド/ロストエンド を含む → lostAndFound\n  e. おまかせ/ランダム を含む → random\n  f. mv/👗 を含む → mv\n\n6) 時間/回数\n- "周回" を含む → unlimited=true。\n- "n時[mm分]まで" → unlimited=true, until="{n}時{mm分}" (例: 23時45分)。\n- "n回" → unlimited=false, until="{n}回" (回数以外のnは除外)。\n\n出力要件: \n- いずれかが欠ける場合(有効な5桁keyNumber / 有効なsongType / 有効なreqStat)は tweets を空配列[]で返す。\n- 数値は数字として。百分率表記(%)は除去。矢印(↑↓)や単位(万)は無視し数値のみ抽出。\n- 曖昧な場合は推測せず、その項目を出力しないのではなく tweets=[] とする。\n\n例1 入力:\n🦐 えび エビ周回\n@ 2\n\n11564\n\n主…先頭120%\n募…先頭120%\n\n出力:\n{"tweets":[{"keyNumber":"11564","peopleRn":2,"masterStat":120,"reqStat":120,"songType":"envy","unlimited":true,"masterTotalStat":false,"reqTotalStat":false}]}\n\n例2 入力:\nベテラン 高速🦐周回 23時45分まで 🗝02292 @33 主 232 (実効値) 求 215↑\n\n出力:\n{"tweets":[{"keyNumber":"02292","peopleRn":3,"masterStat":232,"reqStat":215,"songType":"fast_envy","unlimited":true,"masterTotalStat":true,"reqTotalStat":true,"until":"23時45分"}]}'
      },
    ],
  },
  
  // 생성 설정 (재사용 가능하도록 분리)
  GENERATION_CONFIG: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        tweets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyNumber: { type: "string" },
              peopleRn: { type: "integer" },
              masterStat: { type: "number" },
              reqStat: { type: "number" },
              songType: { type: "string" },
              unlimited: { type: "boolean" },
              masterTotalStat: { type: "boolean" },
              reqTotalStat: { type: "boolean" },
              until: { type: "string" },
            },
            required: [
              "keyNumber",
              "masterStat",
              "reqStat",
              "songType",
              "masterTotalStat",
              "reqTotalStat",
            ]
          },
        },
      },
    },
  }
};

// 콘텐츠 스크립트에서 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "processWithGemini") {
    // API 키 가져오기
    chrome.storage.local.get(["geminiApiKey"], function (result) {
      if (result.geminiApiKey) {
        GEMINI_API_KEY = result.geminiApiKey;
        processWithGemini(message.text)
          .then((result) => {
            console.log("Gemini API 처리 성공");
            sendResponse({ success: true, data: result });
          })
          .catch((error) => {
            console.error("Gemini API 처리 실패:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.error("Gemini API 키가 설정되지 않음");
        sendResponse({
          success: false,
          error: "Gemini API 키가 설정되지 않았습니다.",
        });
      }
    });
    return true; // 비동기 응답을 위해 true 반환
  }
});

// API URL 생성 함수
function getGeminiApiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.MODEL_ID}:${GEMINI_CONFIG.GENERATE_CONTENT_API}?key=${GEMINI_API_KEY}`;
}

// 요청 데이터 생성 함수 (텍스트만 변경되는 부분)
function createRequestData(text) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: text, // 트윗 내용만 동적으로 변경
          },
        ],
      },
    ],
    systemInstruction: GEMINI_CONFIG.SYSTEM_INSTRUCTION, // 미리 정의된 설정 재사용
    generationConfig: GEMINI_CONFIG.GENERATION_CONFIG,   // 미리 정의된 설정 재사용
  };
}

// Gemini API로 텍스트 처리 (generateContent 사용)
async function processWithGemini(text) {
  const url = getGeminiApiUrl();
  const requestData = createRequestData(text);

  try {
    // API 호출
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP 오류! 상태: ${response.status}, 메시지: ${
          errorData.error?.message || "알 수 없는 오류"
        }`
      );
    }

    // generateContent는 단일 응답을 반환하므로 단순히 JSON으로 파싱
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Gemini API 호출 오류:", error);
    throw error;
  }
}
