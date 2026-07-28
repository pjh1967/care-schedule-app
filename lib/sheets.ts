// Google Sheets 서비스 계정 클라이언트
// saesun-care-schedule과 동일한 스프레드시트를, saesun과 "동일한 이름의" 환경변수로 접근한다.
// (Vercel Project Settings > Environment Variables에서 saesun-care-schedule에 이미 등록된
//  값을 그대로 복사해 넣으면 됩니다.)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (개행은 \n 이스케이프로 저장, 아래에서 복원)
//   GOOGLE_SHEETS_SPREADSHEET_ID

import { google } from "googleapis";

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 환경변수가 설정되지 않았습니다."
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const auth = getAuth();
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.");
  return id;
}

/** 간단 재시도 래퍼 (Sheets API 쿼터/일시 오류 대응) */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export async function readRange(range: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range,
    })
  );
  return (res.data.values as string[][]) || [];
}

export async function writeRange(range: string, values: (string | number)[][]) {
  const sheets = getSheetsClient();
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    })
  );
}

export async function clearRange(range: string) {
  const sheets = getSheetsClient();
  await withRetry(() =>
    sheets.spreadsheets.values.clear({
      spreadsheetId: getSpreadsheetId(),
      range,
    })
  );
}

/** 시트가 없으면 생성 (요청입력_v2, 근무표_v2, 배정기준_v2 등 최초 세팅용) */
export async function ensureSheetExists(title: string) {
  const sheets = getSheetsClient();
  const meta = await withRetry(() =>
    sheets.spreadsheets.get({ spreadsheetId: getSpreadsheetId() })
  );
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await withRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      })
    );
  }
}
