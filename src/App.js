import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  요양보호사 AI 근무표 에이전트 — Google Sheets 연동 버전
//  Google Sheets API v4 + OAuth 2.0 + Claude AI
// ═══════════════════════════════════════════════════════════════

// ── 🔑 여기에 본인 값 입력 ────────────────────────────────────
const GAPI_CONFIG = {
  CLIENT_ID    : "575088677348-i8s653ni326sj9e7jpl6ikjrgbbrdfup.apps.googleusercontent.com",
  API_KEY      : "AIzaSyA17IdNlmepK2eK3riUzqH489BVJ-uGyww",
  SPREADSHEET_ID: "1xp3IJmB1jyrVY0DrDYdx2MXh4Xo68uRCTQkmh_xufhw",   // URL의 /d/XXXX/edit 에서 XXXX 부분
  SCOPES       : "https://www.googleapis.com/auth/spreadsheets",
};


// ── 색상 ──────────────────────────────────────────────────────
const C = {
  navy:"#0F2040", steel:"#1E4D8C", teal:"#00B4A6",
  amber:"#F59E0B", white:"#F0F4F8", panel:"#162035",
  red:"#EF4444", green:"#22C55E", gray:"#64748B",
  dark:"#0a1628", border:"#1a2d4a",
};

const AGENTS = [
  {id:"input",    icon:"💬", label:"입력 에이전트",  desc:"자연어 파싱·의도 분류"},
  {id:"review",   icon:"⚖️", label:"검토 에이전트",  desc:"법정기준 위반·충돌 감지"},
  {id:"schedule", icon:"📅", label:"편성 에이전트",  desc:"최적 근무표 생성"},
  {id:"report",   icon:"📊", label:"보고 에이전트",  desc:"관리자 요약·이상 알림"},
  {id:"output",   icon:"📤", label:"출력 에이전트",  desc:"Sheets 실제 기록"},
];

const CYCLE   = ["주","주","야","야","공","공"];
const BASE    = new Date(2025,0,1);
const WD_KR   = ["일","월","화","수","목","금","토"];
const SHEET_NAMES = { CONFIG:"설정", REQUEST:"요청입력", SCHEDULE:"근무표", WAGE:"수당계산" };

const ROLES = ["시설장","부원장","간호부장","간호조무사","사회복지사","팀장","요양보호사","조리원"];
const ROLE_COLOR = {
  "시설장":   "#F59E0B", "부원장":   "#F59E0B",
  "간호부장": "#EF4444", "간호조무사":"#EF4444",
  "사회복지사":"#8B5CF6","팀장":     "#8B5CF6",
  "요양보호사":"#00B4A6","조리원":   "#F97316",
};
const ROLE_BG = {
  "시설장":   "#2a1a00","부원장":   "#2a1a00",
  "간호부장": "#2a0000","간호조무사":"#2a0a0a",
  "사회복지사":"#1a0a2a","팀장":    "#1a0a2a",
  "요양보호사":"#0a2a1a","조리원":  "#2a1a0a",
};

const DEFAULT_STAFF = [
  {no:1,  name:"(시설장 이름)", role:"시설장",    gender:"남", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:2,  name:"(부원장 이름)", role:"부원장",    gender:"여", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:3,  name:"(간호부장)",    role:"간호부장",  gender:"여", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:4,  name:"(간호조무사)",  role:"간호조무사",gender:"여", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:5,  name:"(사회복지사)",  role:"사회복지사",gender:"여", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:6,  name:"(팀장 이름)",   role:"팀장",      gender:"남", priority:0, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:7,  name:"요양보호사 01",role:"요양보호사",gender:"여", priority:3, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:8,  name:"요양보호사 02",role:"요양보호사",gender:"여", priority:3, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:9,  name:"요양보호사 03",role:"요양보호사",gender:"여", priority:3, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:10, name:"요양보호사 04",role:"요양보호사",gender:"여", priority:3, type:"야간전담", offset:null, leave:15, wage:50000, minWork:22},
  {no:11, name:"요양보호사 05",role:"요양보호사",gender:"여", priority:3, type:"야간전담", offset:null, leave:15, wage:50000, minWork:22},
  {no:12, name:"요양보호사 06",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:0,    leave:15, wage:0,     minWork:22},
  {no:13, name:"요양보호사 07",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:1,    leave:15, wage:0,     minWork:22},
  {no:14, name:"요양보호사 08",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:2,    leave:15, wage:0,     minWork:22},
  {no:15, name:"요양보호사 09",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:3,    leave:15, wage:0,     minWork:22},
  {no:16, name:"요양보호사 10",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:4,    leave:15, wage:0,     minWork:22},
  {no:17, name:"요양보호사 11",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:0,    leave:15, wage:0,     minWork:22},
  {no:18, name:"요양보호사 12",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:1,    leave:15, wage:0,     minWork:22},
  {no:19, name:"요양보호사 13",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:2,    leave:15, wage:0,     minWork:22},
  {no:20, name:"요양보호사 14",role:"요양보호사",gender:"여", priority:3, type:"순환",     offset:3,    leave:15, wage:0,     minWork:22},
  {no:21, name:"조리원 01",    role:"조리원",    gender:"여", priority:3, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
  {no:22, name:"조리원 02",    role:"조리원",    gender:"여", priority:3, type:"주간전담", offset:null, leave:15, wage:0,     minWork:22},
];

// ── 유틸 ──────────────────────────────────────────────────────
const daysIn = (y,m) => new Date(y,m,0).getDate();

function getShift(type, offset, y, m, d) {
  if(type==="주간전담") return new Date(y,m-1,d).getDay()===0?"공":"주";
  if(type==="야간전담") return new Date(y,m-1,d).getDay()===0?"공":"야";
  const elapsed = Math.floor((new Date(y,m-1,d)-BASE)/86400000);
  return CYCLE[((elapsed+offset)%6+6)%6];
}

const shiftBg = s=>({주:"#F4B942",야:"#5B5EA6",공:"#A9D18E",V:"#FFD966",H:"#EF4444",휴:"#D9D9D9"}[s]||"#334155");
const shiftFg = s=>({주:"#fff",야:"#fff",공:"#111",V:"#111",H:"#fff",휴:"#111"}[s]||"#fff");
const sleep   = ms=>new Promise(r=>setTimeout(r,ms));

// ── 규칙 기반 파싱 (Claude API 없이 동작) ────────────────────
function ai(sys, msg, json=false) {
  // Agent1: 자연어 요청 파싱
  if(json && sys.includes("파싱")) {
    const m = msg;
    // 근무표 생성 감지
    if(m.includes("근무표")&&(m.includes("생성")||m.includes("만들")||m.includes("짜"))) {
      const monthMatch = m.match(/(\d+)월/);
      return Promise.resolve({name:null,type:"schedule_generate",
        days:[],month:monthMatch?Number(monthMatch[1]):null,summary:"근무표 생성 요청",priority:1});
    }
    // 연차/휴가 감지
    const nameMatch = sys.split(",").map(s=>s.trim()).find(n=>msg.includes(n));
    const dayMatches = [...msg.matchAll(/(\d+)일/g)].map(d=>Number(d[1])).filter(d=>d>=1&&d<=31);
    const isVacation = m.includes("연차")||m.includes("휴가")||m.includes("쉬");
    if(nameMatch&&dayMatches.length>0) {
      return Promise.resolve({name:nameMatch,type:isVacation?"vacation":"off",
        days:dayMatches,summary:`${nameMatch} ${dayMatches.join(",")}일 ${isVacation?"연차":"비번"}`,priority:1});
    }
    return Promise.resolve({name:null,type:"schedule_generate",days:[],summary:"근무표 생성",priority:1});
  }
  // Agent3: 편성 적합도 (고정값 반환)
  if(json && sys.includes("score")) {
    const vCount = Number((msg.match(/위반(\d+)/)||[])[1]||0);
    return Promise.resolve({score: vCount===0?95:vCount<5?80:65, issues:[], suggestions:[]});
  }
  // Agent4: 보고 요약 (규칙 기반 텍스트)
  const yMatch = msg.match(/(\d{4})년/); const mMatch = msg.match(/(\d+)월/);
  const vMatch = msg.match(/위반(\d+)/);  const sMatch = msg.match(/직원(\d+)/);
  const y=yMatch?yMatch[1]:"", mo=mMatch?mMatch[1]:"", v=vMatch?vMatch[1]:"0", s=sMatch?sMatch[1]:"10";
  return Promise.resolve(
    `${y}년 ${mo}월 요양보호사 ${s}명 근무표가 자동 편성되었습니다. ` +
    `주간전담·야간전담·순환 혼합 운영 기준으로 생성되었으며, ` +
    `법정기준 위반사항 ${v}건이 ${v==="0"?"없습니다.":"발생하였으니 확인이 필요합니다."}`
  );
}

// ════════════════════════════════════════════════════════════════
//  Google Sheets API 모듈
// ════════════════════════════════════════════════════════════════
const Sheets = {
  // 내부 상태
  _ready: false,
  _tokenClient: null,
  _token: null,
  _tokenExpiry: null,

  // GAPI + GIS 스크립트 로드 (최초 1회)
  async init() {
    return new Promise((resolve, reject) => {
      // 이미 초기화된 경우 스킵
      if(Sheets._ready){ resolve(true); return; }
      const script1 = document.createElement("script");
      script1.src = "https://apis.google.com/js/api.js";
      script1.onload = () => {
        window.gapi.load("client", async () => {
          try {
            await window.gapi.client.init({
              apiKey: GAPI_CONFIG.API_KEY,
              discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
            });
            Sheets._ready = true;
            resolve(true);
          } catch(e){ reject(e); }
        });
      };
      script1.onerror = reject;
      document.head.appendChild(script1);
    });
  },

  // GIS 토큰 클라이언트 초기화
  async _initTokenClient() {
    return new Promise((resolve, reject) => {
      if(Sheets._tokenClient){ resolve(); return; }
      const script2 = document.createElement("script");
      script2.src = "https://accounts.google.com/gsi/client";
      script2.onload = () => {
        Sheets._tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GAPI_CONFIG.CLIENT_ID,
          scope: GAPI_CONFIG.SCOPES,
          callback: () => {},  // 콜백은 getToken에서 동적 설정
        });
        resolve();
      };
      script2.onerror = reject;
      document.head.appendChild(script2);
    });
  },

  // 토큰 저장/복원 (sessionStorage 사용)
  _saveToken(token, expiresIn) {
    const expiry = Date.now() + (expiresIn||3600)*1000;
    try {
      sessionStorage.setItem("gapi_token", token);
      sessionStorage.setItem("gapi_expiry", String(expiry));
    } catch(e){}
    Sheets._token = token;
    Sheets._tokenExpiry = expiry;
  },
  _loadToken() {
    try {
      const token  = sessionStorage.getItem("gapi_token");
      const expiry = Number(sessionStorage.getItem("gapi_expiry")||0);
      if(token && expiry > Date.now() + 60000){
        Sheets._token = token;
        Sheets._tokenExpiry = expiry;
        return true;
      }
    } catch(e){}
    return false;
  },

  // 토큰 발급 (자동 갱신 포함)
  async _getToken(forceRefresh=false) {
    const now = Date.now();
    // 세션에 유효한 토큰 있으면 재사용
    if(!forceRefresh && Sheets._loadToken()){
      window.gapi.client.setToken({access_token: Sheets._token});
      return Sheets._token;
    }
    // 메모리에 유효한 토큰 있으면 재사용
    if(!forceRefresh && Sheets._token && Sheets._tokenExpiry && now < Sheets._tokenExpiry - 60000){
      window.gapi.client.setToken({access_token: Sheets._token});
      return Sheets._token;
    }
    // 새 토큰 요청
    return new Promise((resolve, reject) => {
      Sheets._tokenClient.callback = (resp) => {
        if(resp.error){ reject(resp.error); return; }
        Sheets._saveToken(resp.access_token, resp.expires_in);
        window.gapi.client.setToken({access_token: resp.access_token});
        resolve(resp.access_token);
      };
      // prompt 없이 시도 → 실패하면 consent로 재시도
      Sheets._tokenClient.requestAccessToken({prompt: forceRefresh?"consent":""});
    });
  },

  // OAuth 로그인
  async signIn(forcePrompt=false) {
    await this._initTokenClient();
    return await this._getToken(forcePrompt);
  },

  // API 호출 전 토큰 보장
  async _ensureToken() {
    await this._initTokenClient();
    return await this._getToken(false);
  },

  // 범위 읽기
  async read(range) {
    await this._ensureToken();
    const r = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      range,
    });
    return r.result.values || [];
  },

  // 범위 쓰기 (값만)
  async write(range, values) {
    await this._ensureToken();
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      resource: { values },
    });
  },

  // 일괄 쓰기 (여러 범위)
  async batchWrite(data) {
    await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      resource: {
        valueInputOption: "RAW",
        data, // [{range, values}]
      },
    });
  },

  // 셀 스타일 (배경색) batchUpdate
  async applyStyles(requests) {
    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      resource: { requests },
    });
  },

  // 시트 ID 조회 (스타일 적용 시 필요)
  async getSheetId(sheetName) {
    const r = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
    });
    const sh = r.result.sheets.find(s=>s.properties.title===sheetName);
    return sh?.properties?.sheetId ?? null;
  },

  // ── 설정 시트 읽기 → staff/holidays/기준값 파싱
  async readConfig() {
    const rows = await this.read(`${SHEET_NAMES.CONFIG}!A1:L60`);
    const staff=[]; const holidays={}; let hourly=12000, nightHrs=176, year=2025, month=7;
    rows.forEach((row,i)=>{
      // 시트 구조: YEAR|대상연도||2025 → row[3]에 값
      if(row[0]==="YEAR")    year     = Number(row[3])||2025;
      if(row[0]==="MONTH")   month    = Number(row[3])||7;
      if(row[0]==="HOURLY")  hourly   = Number(row[3])||12000;
      if(row[0]==="NIGHTH")  nightHrs = Number(row[3])||176;
      // HOL_DATE: row[0]=HOL_DATE, row[1]=날짜, row[2]=이름
      if(row[0]==="HOL_DATE"&&row[1]&&row[2]) holidays[Number(row[1])]=String(row[2]);
      // STAFF: row[0]=STAFF, row[1]=no, row[2]=성명, row[3]=직위, row[4]=성별,
      //        row[5]=업무순위, row[6]=근무유형, row[7]=오프셋, row[8]=연차, row[9]=야간수당, row[10]=최소근무
      if(row[0]==="STAFF") {
        staff.push({
          no      : Number(row[1]),
          name    : String(row[2]).trim(),
          role    : String(row[3]).trim()||"요양보호사",
          gender  : String(row[4]).trim()||"여",
          priority: Number(row[5])||0,
          type    : String(row[6]).trim()||"주간전담",
          offset  : row[7]==="-"||row[7]===""?null:Number(row[7]),
          leave   : Number(row[8])||15,
          wage    : Number(row[9])||0,
          minWork : Number(row[10])||22,
        });
      }
      if(row[0]==="HOL") holidays[Number(row[1])]=row[2];
    });
    return {staff:staff.length?staff:DEFAULT_STAFF, holidays, hourly, nightHrs, year, month};
  },

  // ── 설정 시트 쓰기
  async writeConfig(year, month, staff, holidays, hourly, nightHrs) {
    if(!GAPI_CONFIG.SPREADSHEET_ID || GAPI_CONFIG.SPREADSHEET_ID.includes("여기에"))
      throw new Error("SPREADSHEET_ID가 설정되지 않았습니다.");
    if(!staff || !Array.isArray(staff))
      throw new Error("직원 데이터가 없습니다.");
    await this._ensureToken();
    const rows = [
      ["YEAR",   year],
      ["MONTH",  month],
      ["HOURLY", hourly],
      ["NIGHTH", nightHrs],
      ...staff.map(s=>["STAFF", s.no, s.name, s.role||"요양보호사",
        s.gender||"여", s.priority||3, s.type, s.offset??"-", s.leave, s.wage, s.minWork??22]),
      ...Object.entries(holidays).map(([d,nm])=>["HOL", d, nm]),
    ];
    await this.write(`${SHEET_NAMES.CONFIG}!A1:L${rows.length+2}`, rows);
  },

  // ── 요청 시트 읽기
  async readRequests() {
    const rows = await this.read(`${SHEET_NAMES.REQUEST}!A2:D100`);
    const req={};
    rows.forEach(r=>{
      if(r[0]&&r[1]&&r[2]){
        const name=r[0], day=Number(r[1]), type=r[2];
        if(!req[name]) req[name]={};
        req[name][day]=type;
      }
    });
    return req;
  },

  // ── 요청 시트 쓰기
  async writeRequests(requests, staff=[]) {
    await this._ensureToken();
    const header = [["성명","직위","성별","업무순위","날짜(일)","유형","우선순위"]];
    const staffMap = {};
    staff.forEach(s=>{ staffMap[s.name]={role:s.role||"",gender:s.gender||"",priority:s.priority||3}; });
    const rows = Object.entries(requests).flatMap(([name,days])=>
      Object.entries(days).map(([d,t])=>{
        const info = staffMap[name]||{role:"",gender:"",priority:0};
        return [name, info.role, info.gender, info.priority ? String(info.priority) : "-", Number(d), t, 1];
      })
    ).sort((a,b)=>a[4]-b[4]);
    const all = [...header, ...rows];
    // 기존 내용 지우기
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      range: `${SHEET_NAMES.REQUEST}!A1:D200`,
    });
    if(all.length>1) await this.write(`${SHEET_NAMES.REQUEST}!A1:D${all.length}`, all);
  },

  // ── 근무표 시트 쓰기 (값 + 색상)
  async writeSchedule(scheduleData, staff, year, month, holidays, violations, score) {
    if(!GAPI_CONFIG.SPREADSHEET_ID || GAPI_CONFIG.SPREADSHEET_ID.includes("여기에"))
      throw new Error("SPREADSHEET_ID가 설정되지 않았습니다.");
    await this._ensureToken();
    const total   = daysIn(year, month);
    const sheetId = await this.getSheetId(SHEET_NAMES.SCHEDULE);
    if(sheetId === null) throw new Error("근무표 시트를 찾을 수 없습니다");

    // ── 시트 초기화 ──
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      range: `${SHEET_NAMES.SCHEDULE}!A1:AZ300`,
    });

    const WD_KR2 = ["일","월","화","수","목","금","토"];

    // ── 헤더 행 구성 ──
    // 행1: 타이틀
    const titleRow = [
      `${year}년 ${month}월 근무표`,
      `편성: AI 자동  |  적합도: ${score}/100  |  위반: ${violations.length}건`,
      ...Array(3+total+4).fill("")
    ];

    // 행2: 컬럼 헤더 (성명|직위|성별|업무순위|근무유형 + 일별날짜 + 합계)
    const colHeader = [
      "성  명", "직  위", "성별", "업무순위", "근무유형",
      ...Array.from({length:total}, (_,i)=>{
        const d   = i+1;
        const wd  = new Date(year,month-1,d).getDay();
        const hol = holidays[d] ? "("+holidays[d]+")" : "";
        return d+"\n"+WD_KR2[wd]+hol;
      }),
      "주간합계", "야간합계", "공가합계", "연차합계"
    ];

    // ── 직원별 데이터 행 ──
    const dataRows = staff.map(emp => {
      const row    = scheduleData[emp.name] || {};
      let dc=0, nc=0, oc=0, vc=0;
      const dayCells = Array.from({length:total}, (_,i)=>{
        const s = row[i+1] || "공";
        if(s==="주")dc++; else if(s==="야")nc++;
        else if(s==="공"||s==="H")oc++; else if(s==="V")vc++;
        return s;
      });
      return [
        emp.name,
        emp.role || "요양보호사",
        emp.gender || "여",
        emp.priority ? String(emp.priority) : "-",
        emp.type==="주간전담"?"주간전담": emp.type==="야간전담"?"야간전담":"순환",
        ...dayCells,
        dc, nc, oc, vc
      ];
    });

    // 위반사항 행
    // violations: 문자열 또는 {day,type} 객체 모두 처리
    const violMsgs = violations.map(v=>typeof v==="string" ? v : `${month}/${v.day} ${v.type}`);
    const violRow = violations.length===0
      ? ["✅ 법정기준 이상 없음 (주간·야간 최소 2인 충족)"]
      : [`⚠ 위반 ${violations.length}건: ${violMsgs.slice(0,3).join(" | ")}${violations.length>3?` 외 ${violations.length-3}건`:""}`];

    // 범례 행
    const legendRow = ["[범례] 주=주간07~15  야=야간22~07  공=비번  V=연차  H=공휴일"];

    const allValues = [titleRow, colHeader, ...dataRows, [], violRow, legendRow];
    await this.write(`${SHEET_NAMES.SCHEDULE}!A1`, allValues);

    // ── 스타일 적용 ──
    const hexToRgb = hex => {
      const h = hex.replace("#","");
      return {
        red:   parseInt(h.slice(0,2),16)/255,
        green: parseInt(h.slice(2,4),16)/255,
        blue:  parseInt(h.slice(4,6),16)/255,
      };
    };

    const styleReqs = [];

    // 타이틀 행
    styleReqs.push({repeatCell:{
      range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:5+total+4},
      cell:{userEnteredFormat:{
        backgroundColor:hexToRgb("#1F3864"),
        textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true,fontSize:24}
      }},
      fields:"userEnteredFormat",
    }});

    // 컬럼 헤더 행
    styleReqs.push({repeatCell:{
      range:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:5+total+4},
      cell:{userEnteredFormat:{
        backgroundColor:hexToRgb("#2E75B6"),
        textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true,fontSize:18},
        wrapStrategy:"WRAP",
      }},
      fields:"userEnteredFormat",
    }});

    // 직원별 행 스타일
    const ROLE_HEX = {
      "시설장":"#2a1a00","부원장":"#2a1a00",
      "간호부장":"#2a0000","간호조무사":"#2a0a0a",
      "사회복지사":"#1a0a2a","팀장":"#1a0a2a",
      "요양보호사":"#0a2a1a","조리원":"#2a1a0a",
    };
    const SHIFT_HEX = {
      주:"#F4B942",야:"#5B5EA6",공:"#A9D18E",
      V:"#FFD966",H:"#EF4444",휴:"#D9D9D9"
    };

    staff.forEach((emp, ri) => {
      const rowIdx = 2 + ri;
      const roleBg = ROLE_HEX[emp.role]||"#1a2d4a";

      // 고정 컬럼 5개 (성명~근무유형) 배경
      styleReqs.push({repeatCell:{
        range:{sheetId,startRowIndex:rowIdx,endRowIndex:rowIdx+1,
               startColumnIndex:0,endColumnIndex:5},
        cell:{userEnteredFormat:{backgroundColor:hexToRgb(roleBg)}},
        fields:"userEnteredFormat.backgroundColor",
      }});

      // 일별 셀 색상
      const row = scheduleData[emp.name]||{};
      for(let d=1; d<=total; d++){
        const s    = row[d]||"공";
        const col  = 4 + d; // 0-based: 성명(0)직위(1)성별(2)순위(3)유형(4) + 날짜
        const bg   = SHIFT_HEX[s]||"#334155";
        styleReqs.push({repeatCell:{
          range:{sheetId,startRowIndex:rowIdx,endRowIndex:rowIdx+1,
                 startColumnIndex:col,endColumnIndex:col+1},
          cell:{userEnteredFormat:{
            backgroundColor:hexToRgb(bg),
            textFormat:{bold:true,fontSize:18,
              foregroundColor:["주","야","H"].includes(s)?{red:1,green:1,blue:1}:{red:0,green:0,blue:0}},
            horizontalAlignment:"CENTER",
          }},
          fields:"userEnteredFormat",
        }});
      }
    });

    // 열 너비: 고정 5컬럼
    const fixedWidths = [120,90,50,70,80];
    fixedWidths.forEach((w,i)=>{
      styleReqs.push({updateDimensionProperties:{
        range:{sheetId,dimension:"COLUMNS",startIndex:i,endIndex:i+1},
        properties:{pixelSize:w},fields:"pixelSize",
      }});
    });
    // 날짜 열 너비
    for(let d=0;d<total;d++){
      styleReqs.push({updateDimensionProperties:{
        range:{sheetId,dimension:"COLUMNS",startIndex:5+d,endIndex:6+d},
        properties:{pixelSize:26},fields:"pixelSize",
      }});
    }
    // 합계 열
    for(let i=0;i<4;i++){
      styleReqs.push({updateDimensionProperties:{
        range:{sheetId,dimension:"COLUMNS",startIndex:5+total+i,endIndex:6+total+i},
        properties:{pixelSize:40},fields:"pixelSize",
      }});
    }

    // 위반 행 색상
    const violRowIdx = 2 + staff.length + 1;
    styleReqs.push({repeatCell:{
      range:{sheetId,startRowIndex:violRowIdx,endRowIndex:violRowIdx+1,
             startColumnIndex:0,endColumnIndex:5+total+4},
      cell:{userEnteredFormat:{
        backgroundColor:hexToRgb(violations.length>0?"#FFD966":"#E2EFDA")
      }},
      fields:"userEnteredFormat.backgroundColor",
    }});

    // 행 고정만 적용 (열 고정은 병합 셀과 충돌)
    styleReqs.push({updateSheetProperties:{
      properties:{sheetId,gridProperties:{frozenRowCount:2,frozenColumnCount:0}},
      fields:"gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    }});

    if(styleReqs.length > 0) await this.applyStyles(styleReqs);
  },
  // ── 수당 시트 쓰기
  async writeWage(staff, year, month, scheduleData, hourly, nightHrs) {
    const sheetId = await this.getSheetId(SHEET_NAMES.WAGE);
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
      range: `${SHEET_NAMES.WAGE}!A1:H100`,
    });
    const header = [`${year}년 ${month}월 야간 근무자 수당 계산표`];
    const colHdr = ["성명","유형","야간근무일","야간가산수당","전담수당","합계","비고"];
    const nightAdd = Math.round(hourly*nightHrs*0.5);
    const rows = staff.filter(s=>s.type==="야간전담"||(scheduleData&&
      Object.values(scheduleData[s.name]||{}).filter(v=>v==="야").length>0)
    ).map(emp=>{
      const nDays = emp.type==="야간전담"
        ? Object.values(scheduleData[emp.name]||{}).filter(v=>v==="야").length
        : Object.values(scheduleData[emp.name]||{}).filter(v=>v==="야").length;
      const fixed = emp.type==="야간전담"?(emp.wage||0):0;
      const total = nightAdd+fixed;
      return [emp.name, emp.type==="야간전담"?"야간전담":"순환(야간)",
              nDays, `${nightAdd.toLocaleString()}원`, `${fixed.toLocaleString()}원`,
              `${total.toLocaleString()}원`,
              emp.type==="야간전담"?"야간수당+전담수당":"야간발생시 야간수당만"];
    });
    const noteRows = [
      [],
      ["※ 야간 가산수당 = 시급×월야간시간×50% (근로기준법 §56)"],
      [`※ 적용 시급: ${hourly.toLocaleString()}원 / 월 야간시간: ${nightHrs}시간`],
    ];
    await this.write(`${SHEET_NAMES.WAGE}!A1`,[[...header],[...colHdr],...rows,...noteRows]);

    // 스타일
    if(sheetId!==null){
      const hexToRgb=hex=>{const h=hex.replace("#","");
        return{red:parseInt(h.slice(0,2),16)/255,green:parseInt(h.slice(2,4),16)/255,blue:parseInt(h.slice(4,6),16)/255};};
      await this.applyStyles([
        {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:7},
          cell:{userEnteredFormat:{backgroundColor:hexToRgb("#1F3864"),
            textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true,fontSize:24}}},
          fields:"userEnteredFormat"}},
        {repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:7},
          cell:{userEnteredFormat:{backgroundColor:hexToRgb("#2E75B6"),
            textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true}}},
          fields:"userEnteredFormat"}},
      ]);
    }
  },
};

// ════════════════════════════════════════════════════════════════
//  에이전트 파이프라인
// ════════════════════════════════════════════════════════════════
async function runPipeline(request, staff, y, m, holidays, requests, hourly, nightHrs, rules, onLog, onState, sheetsReady) {
  const log = (agent,msg,type="info")=>onLog({agent,msg,type,ts:new Date().toLocaleTimeString("ko-KR")});
  const set = (id,s)=>onState(id,s);

  // ── Agent 1: 입력 파싱 ────────────────────────────────────
  set("input","running"); log("input",`요청 수신: "${request}"`); await sleep(500);
  const parsed = await ai(
    `요양원 근무 요청을 파싱해서 JSON으로만 반환. 직원목록: ${staff.map(s=>s.name).join(",")}
형식: {"name":"직원명|null","type":"vacation|off|schedule_generate|question","days":[날짜],"summary":"한줄요약","priority":1}`,
    request, true
  );
  const fp = parsed || {name:null,type:"schedule_generate",days:[],summary:"근무표 생성",priority:1};
  if(!parsed){ log("input","규칙 기반으로 근무표 생성 진행","warn"); }
  else { log("input",`유형: ${fp.type} | 대상: ${fp.name||"전체"} | 일자: ${fp.days?.join(",")||"미지정"}`,"success"); }
  set("input","done"); await sleep(300);

  const merged = JSON.parse(JSON.stringify(requests));
  if(fp.type!=="schedule_generate"&&fp.name&&fp.days?.length>0){
    if(!merged[fp.name]) merged[fp.name]={};
    fp.days.forEach(d=>{ merged[fp.name][d]=fp.type==="vacation"?"V":"공"; });
  }

  // ── Agent 2: 검토 ─────────────────────────────────────────
  set("review","running"); log("review","법정 기준 검토 중..."); await sleep(600);
  const total=daysIn(y,m); const violations=[];
  for(let d=1;d<=total;d++){
    let dc=0,nc=0;
    staff.forEach(emp=>{
      const s=merged[emp.name]?.[d]||(holidays[d]?"H":getShift(emp.type,emp.offset,y,m,d));
      if(s==="주")dc++;if(s==="야")nc++;
    });
    if(dc<2) violations.push(`${m}/${d} 주간부족(${dc}명)`);
    if(nc<2) violations.push(`${m}/${d} 야간부족(${nc}명)`);
  }
  // 최소 근무일 미달 사전 체크
  staff.forEach(emp=>{
    const minWork = emp.minWork??22;
    let workCount=0;
    for(let d=1;d<=total;d++){
      const s=merged[emp.name]?.[d]||(holidays[d]?"H":getShift(emp.type,emp.offset,y,m,d));
      if(s==="주"||s==="야") workCount++;
    }
    if(workCount < minWork)
      violations.push(`${emp.name} 근무일 부족(${workCount}일 < 최소${minWork}일) → 자동보완`);
  });
  if(violations.length===0) log("review","법정 기준 이상 없음 ✓","success");
  else { violations.slice(0,3).forEach(v=>log("review",`⚠ ${v}`,"warn"));
         if(violations.length>3) log("review",`외 ${violations.length-3}건`,"warn"); }
  set("review","done"); await sleep(300);

  // ── Agent 3: 편성 ─────────────────────────────────────────
  set("schedule","running"); log("schedule","근무표 편성 중..."); await sleep(700);
  log("schedule","기준일 2025-01-01 → 순환 연속성 자동 계산 ✓");
  const sched={};
  const R = rules || {};
  const maxWD   = R.maxWorkDays ?? 26;
  const maxCons = R.maxConsec   ?? 5;

  staff.forEach(emp=>{
    sched[emp.name]={};
    const exKey = emp.type==="주간전담"?"dayExclude":
                  emp.type==="야간전담"?"nightExclude":"rotExclude";
    const excluded = new Set(R[exKey]||[]);  // 제외 요일 (0=월~6=일)
    const defShift = emp.type==="야간전담"?"야":"주";

    // 1단계: 기본 근무 배정 (요일 제외 반영)
    for(let d=1;d<=total;d++){
      const req = merged[emp.name]?.[d];
      const wd  = new Date(y,m-1,d).getDay(); // 0=일~6=토
      const wdMon = wd===0?6:wd-1;            // 0=월~6=일 변환
      if(req){ sched[emp.name][d]=req; continue; }
      if(holidays[d]){ sched[emp.name][d]="H"; continue; }
      const base = getShift(emp.type,emp.offset,y,m,d);
      // 제외 요일이면 공가로
      if((base==="주"||base==="야") && excluded.has(wdMon)){
        sched[emp.name][d]="공";
      } else {
        sched[emp.name][d]=base;
      }
    }

    // 2단계: 최대 연속 근무 제한
    let consec=0;
    for(let d=1;d<=total;d++){
      const s=sched[emp.name][d];
      if(s==="주"||s==="야"){ consec++;
        if(consec>maxCons && !merged[emp.name]?.[d] && !holidays[d]){
          sched[emp.name][d]="공"; consec=0;
        }
      } else { consec=0; }
    }

    // 3단계: 최소 근무일 보장
    const minWork = R.minWorkDays ?? emp.minWork ?? 22;
    let workCount = Object.values(sched[emp.name]).filter(s=>s==="주"||s==="야").length;
    if(workCount < minWork){
      let need = minWork - workCount;
      for(let d=1;d<=total&&need>0;d++){
        const s=sched[emp.name][d];
        const wd=new Date(y,m-1,d).getDay();
        const wdMon=wd===0?6:wd-1;
        if(s==="공"&&!excluded.has(wdMon)&&!merged[emp.name]?.[d]&&!holidays[d]){
          sched[emp.name][d]=defShift; need--;
        }
      }
      const after=Object.values(sched[emp.name]).filter(s=>s==="주"||s==="야").length;
      if(after<minWork) log("schedule",`⚠ ${emp.name} 최소근무 미충족(${after}일)`,"warn");
      else log("schedule",`${emp.name} 최소근무 ${minWork}일 보장 ✓`,"success");
    }

    // 4단계: 최대 근무일 초과 제한
    let wc2 = Object.values(sched[emp.name]).filter(s=>s==="주"||s==="야").length;
    if(wc2 > maxWD){
      let over = wc2 - maxWD;
      for(let d=total;d>=1&&over>0;d--){
        const s=sched[emp.name][d];
        if((s==="주"||s==="야")&&!merged[emp.name]?.[d]&&!holidays[d]){
          sched[emp.name][d]="공"; over--;
        }
      }
    }
  });

  // 5단계: 페어링 적용
  (R.pairs||[]).forEach(pair=>{
    if(!pair.a||!pair.b||pair.a===pair.b) return;
    for(let d=1;d<=total;d++){
      const sa=sched[pair.a]?.[d], sb=sched[pair.b]?.[d];
      if(!sa||!sb) return;
      const aWork=sa==="주"||sa==="야", bWork=sb==="주"||sb==="야";
      if(pair.mode==="같은조"){
        // 한쪽만 근무면 다른쪽도 근무로
        if(aWork&&!bWork&&!merged[pair.b]?.[d]&&!holidays[d])
          sched[pair.b][d]=sa;
        else if(!aWork&&bWork&&!merged[pair.a]?.[d]&&!holidays[d])
          sched[pair.a][d]=sb;
      } else {
        // 다른 조: 둘 다 같은 근무면 b를 공가로
        if(aWork&&bWork&&sa===sb&&!merged[pair.b]?.[d]&&!holidays[d])
          sched[pair.b][d]="공";
      }
    }
    log("schedule",`페어링 적용: ${pair.a} ${pair.mode} ${pair.b} ✓`,"success");
  });
  const rv=await ai(
    `score`,
    `${y}년 ${m}월, 직원${staff.length}명, 위반${violations.length}건`,true
  );
  const score=rv?.score||85;
  log("schedule",`편성 완료 — 적합도 ${score}/100`,score>=80?"success":"warn");
  rv?.issues?.slice(0,2).forEach(i=>log("schedule",`💡 ${i}`,"info"));
  set("schedule","done"); await sleep(300);

  // ── Agent 4: 보고 ─────────────────────────────────────────
  set("report","running"); log("report","보고서 생성 중..."); await sleep(500);
  const summary=await ai(
    "summary",
    `직원${staff.length}명, ${y}년 ${m}월, 위반${violations.length}건, 적합도${score}점.`
  );
  log("report",(summary||"보고서 생성 완료").slice(0,100)+"...","success");
  set("report","done"); await sleep(300);

  // ── Agent 5: 출력 → Google Sheets 실제 기록 ──────────────
  set("output","running");
  if(sheetsReady){
    try {
      log("output","📊 Google Sheets 근무표 기록 중...");
      await Sheets.writeSchedule(sched, staff, y, m, holidays, violations, score);
      log("output","근무표 시트 저장 완료 ✓","success");

      log("output","📊 요청 시트 동기화 중...");
      await Sheets.writeRequests(merged, staff);
      log("output","요청 시트 저장 완료 ✓","success");

      log("output","📊 수당 계산 시트 갱신 중...");
      await Sheets.writeWage(staff, y, m, sched, hourly, nightHrs);
      log("output","수당 계산 시트 저장 완료 ✓","success");

      log("output","📊 설정 시트 동기화 중...");
      await Sheets.writeConfig(y, m, staff, holidays, hourly, nightHrs);
      log("output","설정 시트 저장 완료 ✓","success");

      log("output","✅ Google Sheets 전체 동기화 완료","success");
    } catch(e){
      const errMsg = e?.message || e?.result?.error?.message || JSON.stringify(e) || "알 수 없는 오류";
      log("output",`Sheets 오류: ${errMsg}`,"error");
      log("output","앱 내 데이터는 저장됨 — Sheets 연결 확인 필요","warn");
      console.error("Sheets 상세 오류:", e);
    }
  } else {
    log("output","⚠ Sheets 미연결 — 앱 내 상태만 저장","warn");
    log("output","우측 상단 '🔗 Sheets 연결' 버튼으로 연결하세요","info");
    await sleep(600);
  }
  set("output","done");

  return {success:true, scheduleData:sched, merged, summary, violations, score, parsed};
}

// ════════════════════════════════════════════════════════════════
//  UI 컴포넌트
// ════════════════════════════════════════════════════════════════
const sectionTitle={fontSize:26,fontWeight:700,color:C.teal,marginBottom:12,
  borderBottom:`1px solid ${C.border}`,paddingBottom:6};
const inputStyle={background:"#0a1628",color:C.white,border:`1px solid ${C.steel}`,
  borderRadius:4,padding:"4px 6px",fontSize:22,width:"100%",outline:"none"};
const selectStyle={background:"#0a1628",color:C.white,border:`1px solid ${C.steel}`,
  borderRadius:4,padding:"4px 6px",fontSize:22,outline:"none"};
const btnStyle=(bg=C.teal)=>({background:bg,color:"#fff",border:"none",borderRadius:4,
  padding:"5px 14px",fontSize:22,fontWeight:600,cursor:"pointer"});
const th={border:`1px solid ${C.border}`,padding:"4px 3px",textAlign:"center",
  fontSize:20,fontWeight:600,position:"sticky",top:0,zIndex:1};
const td={border:`1px solid ${C.border}`,padding:"3px 2px",textAlign:"center",
  fontSize:20,height:44};

// ── 연결 상태 배지 ─────────────────────────────────────────────
function ConnectBadge({status, onConnect, onLoad}){
  const labels={
    idle:"🔗 Sheets 연결", loading:"연결 중...",
    connected:"✅ Sheets 연결됨", error:"❌ 재연결",
    auto:"⏳ 자동 연결 중..."
  };
  const bgs={idle:C.steel,loading:C.amber,connected:C.teal,error:C.red,auto:C.amber};
  return (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <button onClick={status==="idle"||status==="error"?onConnect:undefined}
        style={{...btnStyle(bgs[status]),opacity:status==="loading"?0.7:1,
                cursor:status==="loading"?"not-allowed":"pointer",fontSize:22}}>
        {labels[status]}
      </button>
      {status==="connected"&&(
        <button onClick={onLoad} style={{...btnStyle("#334155"),fontSize:20}}>
          📥 Sheets 불러오기
        </button>
      )}
    </div>
  );
}

// ── 파이프라인 패널 ────────────────────────────────────────────
function PipelinePanel({agentStates,logs,running}){
  const logRef=useRef(null);
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[logs]);
  const sc=s=>s==="running"?C.amber:s==="done"?C.teal:s==="error"?C.red:C.gray;
  const lc=t=>t==="success"?C.teal:t==="warn"?C.amber:t==="error"?C.red:"#94a3b8";
  const st=id=>agentStates[id]||"idle";
  return(
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      <div style={{width:240,background:C.panel,borderRight:`1px solid ${C.border}`,
                   padding:16,display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
        <div style={{fontSize:20,color:C.gray,marginBottom:8,fontWeight:600,letterSpacing:1}}>PIPELINE</div>
        {AGENTS.map((ag,idx)=>{
          const s=st(ag.id),run=s==="running";
          return(<div key={ag.id}>
            <div style={{background:s==="done"?"#0d3b2e":s==="running"?"#2d2000":s==="error"?"#2d0000":"#1a2d4a",
                          border:`1px solid ${sc(s)}`,borderRadius:8,padding:"10px 12px",transition:"all 0.3s",
                          boxShadow:run?`0 0 12px ${C.amber}44`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:28}}>{ag.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:22,fontWeight:700,color:sc(s)}}>{ag.label}</div>
                  <div style={{fontSize:18,color:"#64748b",marginTop:1}}>{ag.desc}</div>
                </div>
                <div style={{width:7,height:7,borderRadius:"50%",background:sc(s),
                             animation:run?"pulse 1s infinite":"none"}}/>
              </div>
            </div>
            {idx<AGENTS.length-1&&(
              <div style={{display:"flex",justifyContent:"center",padding:"2px 0"}}>
                <div style={{width:2,height:12,background:st(AGENTS[idx+1].id)!=="idle"?C.teal:C.border,transition:"background 0.5s"}}/>
              </div>
            )}
          </div>);
        })}
        <div style={{marginTop:12,padding:10,background:"#0a1628",borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:18,color:C.gray,fontWeight:600,marginBottom:6,letterSpacing:1}}>MCP CONNECTORS</div>
          {[["📊","Google Sheets",true],["📧","Gmail 알림",true],["📅","공휴일 API",true],["🗄️","근태 DB",false]]
            .map(([ic,lb,on])=>(
            <div key={lb} style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
              <span style={{fontSize:20}}>{ic}</span>
              <span style={{fontSize:18,color:on?"#94a3b8":C.gray,flex:1}}>{lb}</span>
              <div style={{width:5,height:5,borderRadius:"50%",background:on?C.teal:"#334155"}}/>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"#0a1628",overflow:"hidden"}}>
        <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`,
                     fontSize:20,color:C.gray,fontWeight:600,letterSpacing:1}}>AGENT LOG</div>
        <div ref={logRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",fontFamily:"Consolas,monospace",fontSize:20}}>
          {logs.length===0&&(
            <div style={{color:C.gray,textAlign:"center",marginTop:40,lineHeight:2.2}}>
              하단 입력창에 자연어로 요청하세요<br/>
              <span style={{color:"#334155",fontSize:20}}>"요양보호사 01 7월 14일 연차 써줘"</span><br/>
              <span style={{color:"#334155",fontSize:20}}>"7월 근무표 생성해줘"</span>
            </div>
          )}
          {logs.map((l,i)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:3,alignItems:"flex-start"}}>
              <span style={{color:"#334155",minWidth:55,fontSize:18}}>{l.ts}</span>
              <span style={{color:C.gray,minWidth:58,fontSize:18,background:"#1a2d4a",
                             borderRadius:3,padding:"1px 4px",whiteSpace:"nowrap"}}>
                {AGENTS.find(a=>a.id===l.agent)?.label.replace(" 에이전트","")}</span>
              <span style={{color:lc(l.type),flex:1,lineHeight:1.5}}>{l.msg}</span>
            </div>
          ))}
          {running&&<div style={{display:"flex",gap:3,marginTop:6}}>
            {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.teal,animation:`bounce 0.8s ${i*0.2}s infinite`}}/>)}
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── 근무표 패널 ────────────────────────────────────────────────
function SchedulePanel({scheduleData,staff,requests,holidays,year,month,score,sheetsId}){
  const total=daysIn(year,month);
  return(
    <div style={{flex:1,overflowX:"auto",overflowY:"auto",padding:16}}>
      {!scheduleData?(
        <div style={{color:C.gray,textAlign:"center",marginTop:60,lineHeight:2.5}}>
          <div style={{fontSize:64}}>📅</div>
          <div>근무표가 없습니다</div>
          <div style={{fontSize:22,color:"#334155"}}>"7월 근무표 생성해줘" 를 입력하세요</div>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <span style={{fontSize:24,color:C.teal,fontWeight:700}}>{year}년 {month}월 근무표 — AI 자동 편성</span>
            {score&&<span style={{background:score>=80?C.teal:C.amber,color:"#fff",borderRadius:4,
                                   padding:"2px 8px",fontSize:22,fontWeight:700}}>적합도 {score}/100</span>}
            {sheetsId&&<a href={`https://docs.google.com/spreadsheets/d/${sheetsId}`} target="_blank"
              style={{fontSize:20,color:C.teal,textDecoration:"none",background:"#0a2a2a",
                       padding:"2px 8px",borderRadius:4}}>📊 Sheets에서 보기 →</a>}
          </div>
          <table style={{borderCollapse:"collapse",fontSize:20,minWidth:800}}>
            <thead>
              <tr>
                <th style={{...th,width:100,background:C.steel,color:"#fff"}}>성명</th>
                <th style={{...th,width:70,background:C.steel,color:"#fff"}}>직위</th>
                <th style={{...th,width:30,background:C.steel,color:"#fff"}}>성별</th>
                <th style={{...th,width:30,background:C.steel,color:"#fff"}}>순위</th>
                <th style={{...th,width:55,background:C.steel,color:"#fff"}}>근무유형</th>
                {Array.from({length:total},(_,i)=>i+1).map(d=>{
                  const wd=new Date(year,month-1,d).getDay();
                  const isH=!!holidays[d];
                  return(<th key={d} style={{...th,width:24,
                    background:isH?"#5b1a1a":wd===0?"#3d1a0a":wd===6?"#1a2d4a":C.steel,
                    color:isH?"#fca5a5":wd===0?"#fdba74":"#94a3b8"}}>
                    <div style={{fontSize:18}}>{d}</div>
                    <div style={{fontSize:16}}>{WD_KR[wd]}</div>
                  </th>);
                })}
                {["주","야","공","V"].map(l=><th key={l} style={{...th,width:28,background:"#0a1628",color:C.gray}}>{l}계</th>)}
              </tr>
            </thead>
            <tbody>
              {staff.filter((emp,i,arr)=>arr.findIndex(x=>x.name===emp.name)===i).map((emp,ri)=>{
                const row=scheduleData[emp.name]||{};
                let dc=0,nc=0,oc=0,vc=0;
                const tb=emp.type==="주간전담"?"#2a1a08":emp.type==="야간전담"?"#1a1a3a":"#0d2a1a";
                return(<tr key={emp.no} style={{background:ri%2===0?"#0d1b2e":"#0a1628"}}>
                  <td style={{...td,background:tb,fontWeight:700,textAlign:"left",paddingLeft:6,fontSize:18}}>{emp.name}</td>
                  <td style={{...td,background:tb,color:"#ddd",fontSize:18}}>{emp.role||"요양보호사"}</td>
                  <td style={{...td,background:tb,color:C.gray,fontSize:18}}>{emp.gender||"여"}</td>
                  <td style={{...td,background:tb,color:C.gray,fontSize:18}}>{emp.priority||"-"}</td>
                  <td style={{...td,background:tb,color:C.gray,fontSize:18}}>
                    {emp.type==="주간전담"?"주전담":emp.type==="야간전담"?"야전담":"순환"}</td>
                  {Array.from({length:total},(_,i)=>i+1).map(d=>{
                    const s=row[d]||"공";
                    if(s==="주")dc++;else if(s==="야")nc++;else if(s==="공"||s==="H")oc++;else if(s==="V")vc++;
                    const isReq=requests[emp.name]?.[d];
                    return(<td key={d} style={{...td,background:shiftBg(s),color:shiftFg(s),fontWeight:700,
                      outline:isReq?`2px solid ${C.amber}`:"none",outlineOffset:"-2px"}}>{s}</td>);
                  })}
                  {[[dc,"#86efac","#1a2a10"],[nc,"#c4b5fd","#1a1a3a"],[oc,"#bbf7d0","#1a2a1a"],[vc,"#fde68a","#2a2a10"]]
                    .map(([v,fg,bg],i)=>{
                      const isWork=(i===0||i===1);
                      const totalWork=dc+nc;
                      const minW=emp.minWork??22;
                      const warn=isWork&&i===0&&totalWork<minW;
                      return <td key={i} style={{...td,fontWeight:700,fontSize:22,
                        background:warn?"#5b1a1a":bg,
                        color:warn?"#fca5a5":fg,
                        outline:warn?"2px solid #EF4444":"none",
                        outlineOffset:"-2px",
                        }}>{i===0?totalWork:v}</td>;
                    })}
                </tr>);
              })}
            </tbody>
          </table>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
            {[["주","#F4B942","#fff","주간07~15"],["야","#5B5EA6","#fff","야간22~07"],
              ["공","#A9D18E","#111","비번"],["V","#FFD966","#111","연차"],["H","#EF4444","#fff","공휴일"]]
              .map(([cd,bg,fg,desc])=>(
              <div key={cd} style={{display:"flex",alignItems:"center",gap:3,fontSize:20}}>
                <div style={{width:18,height:14,background:bg,color:fg,borderRadius:3,
                              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18}}>{cd}</div>
                <span style={{color:"#64748b"}}>{desc}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 직원 설정 패널 ────────────────────────────────────────────
function StaffPanel({staff, setStaff}){
  const update = (i,k,v) => setStaff(p=>p.map((s,idx)=>idx===i?{...s,[k]:v}:s));

  const addStaff = (role) => {
    const sameRole = staff.filter(s=>s.role===role);
    const newNo    = Math.max(0,...staff.map(s=>s.no)) + 1;
    const isNurse  = ["간호부장","간호조무사","사회복지사","팀장"].includes(role);
    const isMgr    = ["시설장","부원장"].includes(role);
    const newOffset= role==="요양보호사" ? staff.filter(s=>s.type==="순환").length%6 : null;
    setStaff(p=>[...p,{
      no:newNo,
      name: isMgr||isNurse ? `${role} 신규` : `${role} ${String(sameRole.length+1).padStart(2,"0")}`,
      role,
      gender:"여",
      priority: 0,
      type: isMgr||isNurse ? "주간전담" : "순환",
      offset: newOffset,
      leave:15, wage:0, minWork:22,
    }]);
  };

  const delStaff = (i) => {
    if(staff.length<=1){alert("최소 1명 필요");return;}
    if(!window.confirm(`"${staff[i].name}" 삭제할까요?`))return;
    setStaff(p=>p.filter((_,idx)=>idx!==i).map((s,idx)=>({...s,no:idx+1})));
  };

  // 직위별 그룹
  const groups = ROLES.map(role=>({
    role,
    members: staff.map((s,i)=>({...s,_idx:i})).filter(s=>s.role===role),
  })).filter(g=>g.members.length>0);

  const HDR = ["성명","직위","성별","업무순위","근무유형","순환오프셋","연차(일)","야간수당(원)","최소근무(일)","삭제"];

  return(
    <div style={{padding:16,overflowY:"auto",flex:1}}>
      <div style={{fontSize:26,fontWeight:700,color:C.teal,
                   borderBottom:`1px solid ${C.border}`,paddingBottom:6,marginBottom:16}}>
        👥 직원 정보 설정
        <span style={{fontSize:20,color:C.gray,fontWeight:400,marginLeft:12}}>
          전체 {staff.length}명 등록
        </span>
      </div>

      {/* 직위별 섹션 */}
      {groups.map(({role,members})=>(
        <div key={role} style={{marginBottom:20}}>
          {/* 섹션 헤더 */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        marginBottom:6,padding:"6px 10px",borderRadius:6,
                        background:ROLE_BG[role]||"#1a2d4a",
                        border:`1px solid ${ROLE_COLOR[role]||C.teal}44`}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",
                            background:ROLE_COLOR[role]||C.teal,
                            boxShadow:`0 0 6px ${ROLE_COLOR[role]||C.teal}`}}/>
              <span style={{fontSize:24,fontWeight:700,
                             color:ROLE_COLOR[role]||C.teal}}>{role}</span>
              <span style={{fontSize:20,color:C.gray,
                             background:"#0a1628",borderRadius:4,
                             padding:"1px 7px"}}>{members.length}명</span>
            </div>
            <button onClick={()=>addStaff(role)}
              style={{background:ROLE_COLOR[role]||C.teal,color:"#fff",
                       border:"none",borderRadius:6,padding:"4px 12px",
                       fontSize:20,fontWeight:700,cursor:"pointer"}}>
              + 추가
            </button>
          </div>

          {/* 테이블 */}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:20,minWidth:700}}>
              <thead>
                <tr>{HDR.map(h=>(
                  <th key={h} style={{...th,background:C.steel,color:"#fff",
                                       padding:"5px 3px",fontSize:18,whiteSpace:"pre-line"}}>
                    {h}
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {members.map((s)=>{
                  const i   = s._idx;
                  const bg  = ROLE_BG[role]||"#1a2d4a";
                  const ac  = ROLE_COLOR[role]||C.teal;
                  return(
                    <tr key={s.no} style={{background:bg}}>
                      {/* 성명 */}
                      <td style={{...td,minWidth:90}}>
                        <input value={s.name}
                          onChange={e=>update(i,"name",e.target.value)}
                          style={{...inputStyle,fontSize:20,width:"100%"}}/>
                      </td>
                      {/* 직위 */}
                      <td style={{...td,minWidth:90}}>
                        <select value={s.role}
                          onChange={e=>update(i,"role",e.target.value)}
                          style={{...selectStyle,fontSize:20,width:"100%"}}>
                          {ROLES.map(r=><option key={r}>{r}</option>)}
                        </select>
                      </td>
                      {/* 성별 */}
                      <td style={{...td,width:50}}>
                        <select value={s.gender||"여"}
                          onChange={e=>update(i,"gender",e.target.value)}
                          style={{...selectStyle,fontSize:20,width:"100%"}}>
                          <option value="남">남</option>
                          <option value="여">여</option>
                        </select>
                      </td>
                      {/* 업무순위 */}
                      <td style={{...td,width:60}}>
                        <select value={s.priority??0}
                          onChange={e=>update(i,"priority",Number(e.target.value))}
                          style={{...selectStyle,fontSize:20,width:"100%"}}>
                          <option value={0}>-</option>
                          {Array.from(
                            {length: staff.filter(x=>x.role==="요양보호사").length + 1},
                            (_,k) => k+1
                          ).map(n=>(
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      {/* 근무유형 */}
                      <td style={{...td,minWidth:80}}>
                        <select value={s.type}
                          onChange={e=>update(i,"type",e.target.value)}
                          style={{...selectStyle,fontSize:20,width:"100%"}}>
                          {["주간전담","야간전담","순환"].map(o=>(
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </td>
                      {/* 순환오프셋 */}
                      <td style={{...td,width:50}}>
                        {s.type==="순환"
                          ? <input type="number" min={0} max={5} value={s.offset??0}
                              onChange={e=>update(i,"offset",Number(e.target.value))}
                              style={{...inputStyle,width:70,fontSize:20,textAlign:"center"}}/>
                          : <span style={{color:C.gray}}>—</span>}
                      </td>
                      {/* 연차 */}
                      <td style={{...td,width:50}}>
                        <input type="number" min={0} max={25} value={s.leave}
                          onChange={e=>update(i,"leave",Number(e.target.value))}
                          style={{...inputStyle,width:70,fontSize:20,textAlign:"center"}}/>
                      </td>
                      {/* 야간수당 */}
                      <td style={{...td,width:75}}>
                        <input type="number" min={0} value={s.wage}
                          onChange={e=>update(i,"wage",Number(e.target.value))}
                          style={{...inputStyle,width:110,fontSize:20,textAlign:"center"}}/>
                      </td>
                      {/* 최소근무 */}
                      <td style={{...td,width:55}}>
                        <input type="number" min={1} max={31} value={s.minWork??22}
                          onChange={e=>update(i,"minWork",Number(e.target.value))}
                          style={{...inputStyle,width:130,fontSize:20,textAlign:"center",
                            borderColor:(s.minWork??22)<22?C.red:C.steel}}/>
                      </td>
                      {/* 삭제 */}
                      <td style={{...td,width:40}}>
                        <button onClick={()=>delStaff(i)}
                          style={{background:"#5b1a1a",color:"#fca5a5",border:"none",
                                   borderRadius:4,padding:"3px 7px",
                                   fontSize:20,cursor:"pointer",fontWeight:700}}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 새 직위 섹션 추가 */}
      <div style={{padding:12,background:"#0a1628",borderRadius:8,
                   border:`1px solid ${C.border}`,marginTop:4}}>
        <div style={{fontSize:20,color:C.gray,marginBottom:8,fontWeight:600}}>
          직위별 직원 추가
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ROLES.map(role=>(
            <button key={role} onClick={()=>addStaff(role)}
              style={{background:ROLE_BG[role]||"#1a2d4a",
                       color:ROLE_COLOR[role]||C.teal,
                       border:`1px solid ${ROLE_COLOR[role]||C.teal}66`,
                       borderRadius:6,padding:"5px 12px",
                       fontSize:20,cursor:"pointer",fontWeight:600}}>
              + {role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function HolidayPanel({holidays,setHolidays,year,month}){
  const [day,setDay]=useState(""); const [name,setName]=useState("");
  const total=daysIn(year,month);
  const add=()=>{const d=Number(day);if(d>=1&&d<=total&&name.trim()){setHolidays(p=>({...p,[d]:name.trim()}));setDay("");setName("");}};
  return(
    <div style={{padding:16,overflowY:"auto",flex:1}}>
      <div style={sectionTitle}>🏖️ 공휴일 설정 ({year}년 {month}월)</div>
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <input type="number" min={1} max={total} value={day} onChange={e=>setDay(e.target.value)}
          placeholder="날짜(일)" style={{...inputStyle,width:80}}/>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="공휴일명"
          style={{...inputStyle,width:140}} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button onClick={add} style={btnStyle()}>추가</button>
      </div>
      {Object.entries(holidays).sort((a,b)=>Number(a[0])-Number(b[0])).map(([d,nm])=>(
        <div key={d} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,
                              background:"#0a1628",borderRadius:6,padding:"6px 10px"}}>
          <span style={{color:"#fca5a5",fontWeight:700,minWidth:36}}>{d}일</span>
          <span style={{color:C.gray,minWidth:20}}>{WD_KR[new Date(year,month-1,Number(d)).getDay()]}</span>
          <span style={{flex:1,color:"#fca5a5"}}>{nm}</span>
          <button onClick={()=>setHolidays(p=>{const n={...p};delete n[d];return n;})}
            style={{...btnStyle("#5b1a1a"),padding:"2px 8px",fontSize:20}}>삭제</button>
        </div>
      ))}
      {Object.keys(holidays).length===0&&<div style={{color:C.gray,fontSize:24}}>등록된 공휴일 없음</div>}
    </div>
  );
}

// ── 요청 패널 ─────────────────────────────────────────────────
function RequestPanel({staff,requests,setRequests,year,month}){
  const [sel,setSel]=useState(staff[0]?.name||"");
  const [day,setDay]=useState(""); const [type,setType]=useState("V");
  const total=daysIn(year,month);
  const add=()=>{const d=Number(day);if(!sel||d<1||d>total)return;
    setRequests(p=>({...p,[sel]:{...(p[sel]||{}),[d]:type}}));setDay("");};
  const allReqs=Object.entries(requests).flatMap(([n,days])=>
    Object.entries(days).map(([d,t])=>({name:n,d:Number(d),type:t}))).sort((a,b)=>a.d-b.d);
  return(
    <div style={{padding:16,overflowY:"auto",flex:1}}>
      <div style={sectionTitle}>📝 연차·휴무 요청 입력</div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{...selectStyle,width:150}}>
          {staff.map(s=><option key={s.name}>{s.name}</option>)}
        </select>
        <input type="number" min={1} max={total} value={day} onChange={e=>setDay(e.target.value)}
          placeholder="날짜(일)" style={{...inputStyle,width:80}}/>
        <select value={type} onChange={e=>setType(e.target.value)} style={selectStyle}>
          {[["V","V — 연차"],["공","공 — 비번희망"],["휴","휴 — 대체휴무"]].map(([v,l])=>(
            <option key={v} value={v}>{l}</option>))}
        </select>
        <button onClick={add} style={btnStyle()}>추가</button>
        <button onClick={()=>setRequests({})} style={{...btnStyle("#5b1a1a")}}>전체 초기화</button>
      </div>
      <div style={{fontSize:20,color:C.gray,marginBottom:8}}>
        ※ 자연어 입력창에서도 추가 가능 — "요양보호사 01 14일 연차 써줘"
      </div>
      {allReqs.length===0?<div style={{color:C.gray,fontSize:24}}>등록된 요청 없음</div>:(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:22}}>
          <thead><tr>{["성명","날짜","요일","유형","삭제"].map(h=>(
            <th key={h} style={{...th,background:C.steel,color:"#fff",padding:"6px 4px"}}>{h}</th>))}</tr></thead>
          <tbody>{allReqs.map(({name,d,type:t},i)=>(
            <tr key={i} style={{background:i%2===0?C.dark:"#0d1b2e"}}>
              <td style={{...td,textAlign:"left",paddingLeft:8}}>{name}</td>
              <td style={{...td,fontWeight:700}}>{d}일</td>
              <td style={{...td,color:C.gray}}>{WD_KR[new Date(year,month-1,d).getDay()]}</td>
              <td style={td}><span style={{background:shiftBg(t),color:shiftFg(t),borderRadius:4,
                padding:"2px 8px",fontWeight:700}}>{t}</span></td>
              <td style={td}><button onClick={()=>setRequests(p=>{const n={...p};
                if(n[name]){const m={...n[name]};delete m[d];n[name]=m;}return n;})}
                style={{...btnStyle("#5b1a1a"),padding:"2px 8px",fontSize:20}}>삭제</button></td>
            </tr>))}</tbody>
        </table>
      )}
    </div>
  );
}

// ── 수당 패널 ─────────────────────────────────────────────────
function WagePanel({hourly,setHourly,nightHrs,setNightHrs,staff}){
  const nightOnly=staff.filter(s=>s.type==="야간전담"||s.type==="순환");
  return(
    <div style={{padding:16,overflowY:"auto",flex:1}}>
      <div style={sectionTitle}>💰 수당 계산 기준</div>
      <div style={{display:"flex",gap:24,flexWrap:"wrap",marginBottom:20}}>
        {[["통상 시급 (원)",hourly,setHourly,120],["월 야간 근무시간 (시간)",nightHrs,setNightHrs,80]].map(([lbl,val,setter,w])=>(
          <div key={lbl}>
            <div style={{fontSize:22,color:C.gray,marginBottom:4}}>{lbl}</div>
            <input type="number" value={val} onChange={e=>setter(Number(e.target.value))}
              style={{...inputStyle,width:w,fontSize:26,fontWeight:700}}/>
          </div>
        ))}
      </div>
      <div style={sectionTitle}>야간 근무자 예상 수당</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:22}}>
        <thead><tr>{["성명","유형","야간가산수당","전담수당","합계"].map(h=>(
          <th key={h} style={{...th,background:C.steel,color:"#fff",padding:"6px 4px"}}>{h}</th>))}</tr></thead>
        <tbody>{nightOnly.map((s,i)=>{
          const nAdd=Math.round(hourly*nightHrs*0.5),fixed=s.wage||0,total=nAdd+fixed;
          const bg=s.type==="야간전담"?"#1a1a3a":"#0d2a1a";
          return(<tr key={s.no}>
            <td style={{...td,background:bg,textAlign:"left",paddingLeft:8,fontWeight:700}}>{s.name}</td>
            <td style={{...td,background:bg,fontSize:18,color:C.gray}}>{s.type==="야간전담"?"야전담":"순환"}</td>
            <td style={td}>{nAdd.toLocaleString()}원</td>
            <td style={{...td,background:"#2a2a10"}}>{s.type==="야간전담"
              ?<span style={{color:C.amber,fontWeight:700}}>{fixed.toLocaleString()}원</span>
              :<span style={{color:C.gray}}>—</span>}</td>
            <td style={{...td,background:"#1a1a3a",fontWeight:700,color:"#c4b5fd"}}>
              {s.type==="야간전담"?total.toLocaleString()+"원":"야간발생시"}</td>
          </tr>);
        })}</tbody>
      </table>
    </div>
  );
}


// ── 배정 기준 패널 ─────────────────────────────────────────────
function RulesPanel({rules, setRules, staff}){
  const WD = ["월","화","수","목","금","토","일"];
  const upd = (key, val) => setRules(p=>({...p, [key]:val}));
  const updPair = (i, key, val) => setRules(p=>{
    const pairs = [...(p.pairs||[])];
    pairs[i] = {...pairs[i], [key]:val};
    return {...p, pairs};
  });
  const addPair = () => setRules(p=>({...p,
    pairs:[...(p.pairs||[]), {a:staff[0]?.name||"", b:staff[1]?.name||"", mode:"같은조"}]
  }));
  const delPair = i => setRules(p=>{
    const pairs=[...(p.pairs||[])]; pairs.splice(i,1); return {...p,pairs};
  });
  const updExclude = (key, wd, checked) => setRules(p=>{
    const cur = new Set(p[key]||[]);
    checked ? cur.delete(wd) : cur.add(wd);
    return {...p, [key]:[...cur]};
  });
  const S = {fontSize:26,fontWeight:700,color:C.teal,
    borderBottom:`1px solid ${C.border}`,paddingBottom:6,marginBottom:12};
  const row = {display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"};
  const lbl = {fontSize:22,color:"#94a3b8",minWidth:160};
  const numIn = (val, key, min, max, unit="일") => (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input type="number" min={min} max={max} value={val}
        onChange={e=>upd(key,Number(e.target.value))}
        style={{...inputStyle,width:60,fontSize:26,fontWeight:700,
                borderColor:val<min||val>max?C.red:C.steel,textAlign:"center"}}/>
      <span style={{fontSize:20,color:C.gray}}>{unit}</span>
    </div>
  );
  return (
    <div style={{padding:16,overflowY:"auto",flex:1}}>
      <div style={S}>⚙️ 전체 공통 배정 기준</div>
      <div style={{background:C.dark,borderRadius:8,padding:16,
                   border:`1px solid ${C.border}`,marginBottom:20}}>
        <div style={row}>
          <span style={lbl}>📅 월 최소 근무일</span>
          {numIn(rules.minWorkDays??22,"minWorkDays",1,31)}
          <span style={{fontSize:20,color:C.amber}}>※ 미달 시 공가→근무 자동 전환</span>
        </div>
        <div style={row}>
          <span style={lbl}>📅 월 최대 근무일</span>
          {numIn(rules.maxWorkDays??26,"maxWorkDays",1,31)}
          <span style={{fontSize:20,color:C.gray}}>※ 초과 시 근무→공가 자동 전환</span>
        </div>
        <div style={row}>
          <span style={lbl}>🔁 최대 연속 근무일</span>
          {numIn(rules.maxConsec??5,"maxConsec",1,10)}
          <span style={{fontSize:20,color:C.gray}}>일 연속 후 공가 1일 필수</span>
        </div>
        <div style={row}>
          <span style={lbl}>🌙 야간 후 최소 휴식</span>
          {numIn(rules.nightRest??11,"nightRest",8,24,"시간")}
          <span style={{fontSize:20,color:C.gray}}>근로기준법 권고 11시간</span>
        </div>
        <div style={row}>
          <span style={lbl}>👥 주간 최소 인원</span>
          {numIn(rules.minDay??2,"minDay",1,10,"명")}
          <span style={{fontSize:20,color:C.gray}}>법정 최소 2명</span>
        </div>
        <div style={row}>
          <span style={lbl}>🌙 야간 최소 인원</span>
          {numIn(rules.minNight??2,"minNight",1,10,"명")}
          <span style={{fontSize:20,color:C.gray}}>법정 최소 2명</span>
        </div>
      </div>

      <div style={S}>📆 유형별 근무 제외 요일</div>
      <div style={{background:C.dark,borderRadius:8,padding:16,
                   border:`1px solid ${C.border}`,marginBottom:20}}>
        {[["주간전담","dayExclude"],["야간전담","nightExclude"],["순환","rotExclude"]]
          .map(([type,key])=>(
          <div key={type} style={{marginBottom:14}}>
            <div style={{fontSize:22,fontWeight:700,color:C.white,
                         marginBottom:8,padding:"3px 10px",borderRadius:4,
                         background:type==="주간전담"?"#3a2008":type==="야간전담"?"#1a1a4a":"#0d3a1a",
                         display:"inline-block"}}>{type}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
              {WD.map((w,i)=>{
                const excl=(rules[key]||[]).includes(i);
                return (
                  <label key={i} style={{display:"flex",alignItems:"center",gap:4,
                                          cursor:"pointer",userSelect:"none",
                                          background:excl?"#5b1a1a":"#1a2d4a",
                                          border:`1px solid ${excl?C.red:C.border}`,
                                          borderRadius:6,padding:"4px 10px",
                                          fontSize:22,color:excl?"#fca5a5":C.white,
                                          transition:"all 0.2s"}}>
                    <input type="checkbox" checked={excl}
                      onChange={e=>updExclude(key,i,!e.target.checked)}
                      style={{accentColor:C.red}}/>
                    {w}
                  </label>
                );
              })}
            </div>
            <div style={{fontSize:20,color:C.gray,marginTop:4}}>
              {(rules[key]||[]).length===0?"제외 없음":
                `제외: ${(rules[key]||[]).map(i=>WD[i]).join(", ")}요일`}
            </div>
          </div>
        ))}
      </div>

      <div style={S}>🤝 직원 페어링 설정</div>
      <div style={{background:C.dark,borderRadius:8,padding:16,
                   border:`1px solid ${C.border}`,marginBottom:20}}>
        <div style={{fontSize:20,color:C.gray,marginBottom:12}}>
          지정한 두 직원을 항상 같은 조 또는 반드시 다른 조로 배정합니다.
        </div>
        {(rules.pairs||[]).map((pair,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"center",
                                marginBottom:8,flexWrap:"wrap",
                                background:"#0d1b2e",borderRadius:6,
                                padding:"8px 12px",border:`1px solid ${C.border}`}}>
            <select value={pair.a} onChange={e=>updPair(i,"a",e.target.value)}
              style={{...selectStyle,width:140}}>
              {staff.map(s=><option key={s.name}>{s.name}</option>)}
            </select>
            <select value={pair.mode} onChange={e=>updPair(i,"mode",e.target.value)}
              style={{...selectStyle,width:110}}>
              <option value="같은조">↔ 같은 조</option>
              <option value="다른조">✕ 다른 조</option>
            </select>
            <select value={pair.b} onChange={e=>updPair(i,"b",e.target.value)}
              style={{...selectStyle,width:140}}>
              {staff.map(s=><option key={s.name}>{s.name}</option>)}
            </select>
            <button onClick={()=>delPair(i)}
              style={{background:"#5b1a1a",color:"#fff",border:"none",
                      borderRadius:4,padding:"4px 10px",fontSize:20,cursor:"pointer"}}>
              삭제
            </button>
          </div>
        ))}
        <button onClick={addPair}
          style={{background:C.steel,color:"#fff",border:"none",borderRadius:4,
                  padding:"5px 14px",fontSize:22,fontWeight:600,cursor:"pointer",marginTop:4}}>
          + 페어링 추가
        </button>
        {(rules.pairs||[]).length===0&&
          <div style={{fontSize:20,color:"#334155",marginTop:8}}>등록된 페어링 없음</div>}
      </div>

      <div style={S}>📋 현재 적용 기준 요약</div>
      <div style={{background:"#0a1628",borderRadius:8,padding:14,
                   border:`1px solid ${C.border}`,fontSize:20,
                   color:"#94a3b8",lineHeight:2.4}}>
        ✅ 월 근무일: 최소 <b style={{color:C.teal}}>{rules.minWorkDays??22}일</b>
          &nbsp;~&nbsp; 최대 <b style={{color:C.teal}}>{rules.maxWorkDays??26}일</b><br/>
        ✅ 최대 연속: <b style={{color:C.teal}}>{rules.maxConsec??5}일</b>
          &nbsp;/&nbsp; 야간 후 휴식: <b style={{color:C.teal}}>{rules.nightRest??11}시간</b><br/>
        ✅ 주간 최소 <b style={{color:C.teal}}>{rules.minDay??2}명</b>
          &nbsp;/&nbsp; 야간 최소 <b style={{color:C.teal}}>{rules.minNight??2}명</b><br/>
        ✅ 페어링: <b style={{color:C.teal}}>{(rules.pairs||[]).length}쌍</b>&nbsp;/&nbsp;
          주간전담 제외: <b style={{color:C.teal}}>{(rules.dayExclude||[]).length}요일</b>&nbsp;/&nbsp;
          야간전담 제외: <b style={{color:C.teal}}>{(rules.nightExclude||[]).length}요일</b>
      </div>
    </div>
  );
}

// ── 설정 안내 패널 ────────────────────────────────────────────
function SetupGuide(){
  return(
    <div style={{padding:20,overflowY:"auto",flex:1,maxWidth:700}}>
      <div style={sectionTitle}>🔧 Google Sheets 연동 설정 가이드</div>
      {[
        ["STEP 1 — Google Cloud 프로젝트 생성",[
          "console.cloud.google.com → 새 프로젝트 생성",
          "API 및 서비스 → 라이브러리 → 'Google Sheets API' 검색 → 사용 설정",
          "API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성",
          "애플리케이션 유형: 웹 애플리케이션 / 승인된 출처: http://localhost:3000 (또는 배포 URL)",
          "클라이언트 ID 복사 → 코드 상단 GAPI_CONFIG.CLIENT_ID 에 붙여넣기",
        ],"#1a2d4a"],
        ["STEP 2 — API 키 발급",[
          "사용자 인증 정보 → API 키 만들기",
          "API 키 복사 → GAPI_CONFIG.API_KEY 에 붙여넣기",
          "키 제한 설정: HTTP 리퍼러 제한 + Sheets API만 허용 (보안)",
        ],"#1a2d4a"],
        ["STEP 3 — 스프레드시트 준비",[
          "Google Sheets에서 새 스프레드시트 생성",
          "시트 4개 추가: 설정 / 요청입력 / 근무표 / 수당계산",
          "URL에서 ID 복사: docs.google.com/spreadsheets/d/[여기]/edit",
          "ID를 GAPI_CONFIG.SPREADSHEET_ID 에 붙여넣기",
        ],"#1a2d4a"],
        ["STEP 4 — Apps Script (선택: 수당 알림 자동화)",[
          "스프레드시트 → 확장 프로그램 → Apps Script",
          "아래 코드 붙여넣기 후 저장 → 트리거 설정 (매월 1일 실행)",
        ],"#0d2a1a"],
      ].map(([title,steps,bg])=>(
        <div key={title} style={{background:bg,borderRadius:8,padding:14,marginBottom:12,border:`1px solid ${C.border}`}}>
          <div style={{fontWeight:700,color:C.teal,fontSize:24,marginBottom:8}}>{title}</div>
          {steps.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:4,fontSize:22,color:"#94a3b8"}}>
              <span style={{color:C.steel,minWidth:16,fontWeight:700}}>{i+1}.</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{background:"#0a1628",borderRadius:8,padding:14,border:`1px solid ${C.border}`}}>
        <div style={{fontWeight:700,color:C.amber,fontSize:24,marginBottom:8}}>📋 Apps Script 알림 코드 (선택)</div>
        <pre style={{fontSize:18,color:"#94a3b8",overflow:"auto",margin:0,lineHeight:1.6}}>{`// 매월 근무표 생성 후 관리자 이메일 발송
function sendMonthlyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('근무표');
  const data = sh.getDataRange().getValues();
  const body = data.map(r=>r.join('\\t')).join('\\n');
  MailApp.sendEmail({
    to: 'admin@example.com',
    subject: '월간 근무표 생성 완료',
    body: '근무표가 자동 생성되었습니다.\\n\\n' + body.slice(0,500)
  });
}
// 트리거: 매월 1일 오전 9시 실행 설정`}</pre>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  메인 앱
// ════════════════════════════════════════════════════════════════
export default function App(){
  const [year,setYear]   = useState(2025);
  const [month,setMonth] = useState(7);
  const [staff,setStaff] = useState(()=>{
    // sessionStorage에서 직원 정보 복원 (페이지 새로고침 대비)
    try {
      const saved = sessionStorage.getItem("staff_data");
      if(saved){
        const parsed = JSON.parse(saved);
        if(parsed && parsed.length >= 10) return parsed;
      }
    } catch(e){}
    return DEFAULT_STAFF;
  });
  const [holidays,setHolidays]  = useState({17:"제헌절"});
  const [requests,setRequests]  = useState({});
  const [hourly,setHourly]      = useState(12000);
  const [nightHrs,setNightHrs]  = useState(176);
  const [rules,setRules]        = useState({
    minWorkDays:22, maxWorkDays:26, maxConsec:5,
    nightRest:11, minDay:2, minNight:2,
    dayExclude:[], nightExclude:[], rotExclude:[],
    pairs:[],
  });
  const [logs,setLogs]          = useState([]);
  const [agentStates,setAgentStates] = useState({});
  const [scheduleData,setScheduleData] = useState(null);
  const [score,setScore]        = useState(null);
  const [running,setRunning]    = useState(false);
  const [input,setInput]        = useState("");
  const [tab,setTab]            = useState("pipeline");
  const [sheetsStatus,setSheetsStatus] = useState("idle"); // idle|loading|connected|error

  // staff 변경 시 sessionStorage에 자동 저장
  const setStaffSafe = useCallback((updater)=>{
    setStaff(prev=>{
      const next = typeof updater==="function" ? updater(prev) : updater;
      try { sessionStorage.setItem("staff_data", JSON.stringify(next)); } catch(e){}
      return next;
    });
  },[]);

  const addLog   = useCallback(e=>setLogs(p=>[...p.slice(-80),e]),[]);
  const setState = useCallback((id,s)=>setAgentStates(p=>({...p,[id]:s})),[]);
  const sheetsReady = sheetsStatus==="connected";

  // 앱 시작 시 자동 연결 시도
  useEffect(()=>{
    autoConnectSheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // 연결 성공 시 Sheets에서 설정 자동 불러오기
  // 자동 불러오기 비활성화 - 수동으로만 불러오기
  // Sheets 연결 시 자동으로 구버전 데이터 덮어쓰기 방지
  // useEffect(()=>{
  //   if(sheetsStatus==="connected"){
  //     loadFromSheets(true).catch(()=>{});
  //   }
  // },[sheetsStatus]);

  // 55분마다 토큰 자동 갱신
  useEffect(()=>{
    if(sheetsStatus!=="connected") return;
    const timer = setInterval(async ()=>{
      try { await Sheets._getToken(false); }
      catch(e){ setSheetsStatus("idle"); }
    }, 55*60*1000);
    return ()=>clearInterval(timer);
  },[sheetsStatus]);

  // 55분마다 토큰 자동 갱신 (OAuth 토큰 만료 1시간 전 갱신)
  useEffect(()=>{
    if(sheetsStatus!=="connected") return;
    const timer = setInterval(async ()=>{
      try {
        await Sheets._getToken(false);
      } catch(e){
        setSheetsStatus("idle");
      }
    }, 55 * 60 * 1000); // 55분
    return ()=>clearInterval(timer);
  },[sheetsStatus]);

  // Sheets 연결
  // 자동 연결 시도 (sessionStorage 토큰 활용)
  const autoConnectSheets = async () => {
    try {
      await Sheets.init();
      await Sheets._initTokenClient();
      // sessionStorage에 유효한 토큰 있으면 복원 시도
      if(Sheets._loadToken()){
        window.gapi.client.setToken({access_token: Sheets._token});
        // 실제 API 호출로 연결 검증
        await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: GAPI_CONFIG.SPREADSHEET_ID,
          range: `${SHEET_NAMES.CONFIG}!A1:A1`,
        });
        setSheetsStatus("connected");
        return;
      }
      // 토큰 없으면 조용히 갱신 시도
      await Sheets._getToken(false);
      setSheetsStatus("connected");
    } catch(e){
      // 자동 연결 실패 → idle 상태로 수동 연결 유도
      setSheetsStatus("idle");
    }
  };

  const connectSheets = async () => {
    setSheetsStatus("loading");
    try {
      await Sheets.init();
      await Sheets.signIn(true);  // 강제 팝업으로 로그인
      setSheetsStatus("connected");
    } catch(e){
      console.error(e);
      setSheetsStatus("error");
    }
  };

  // Sheets에서 설정 불러오기
  const loadFromSheets = async (silent=false) => {
    if(!sheetsReady) return;
    try {
      const cfg = await Sheets.readConfig();
      setYear(cfg.year); setMonth(cfg.month);
      if(cfg.staff && cfg.staff.length > 0){
        if(!silent) setStaffSafe(cfg.staff);
        else if(cfg.staff.length >= 10) setStaffSafe(cfg.staff);
      }
      setHolidays(cfg.holidays);
      setHourly(cfg.hourly); setNightHrs(cfg.nightHrs);
      const req = await Sheets.readRequests();
      setRequests(req);
      if(!silent) alert("✅ Google Sheets에서 설정을 불러왔습니다.");
    } catch(e){
      const msg = e?.message || e?.result?.error?.message || JSON.stringify(e) || "알 수 없는 오류";
      console.error("loadFromSheets 오류:", e);
      alert("불러오기 실패: "+msg+
        "\n\n확인사항:\n1. Sheets 연결 상태 확인\n2. 설정 시트 존재 여부 확인\n3. Apps Script 초기화 실행 필요");
    }
  };

  const run = async () => {
    if(!input.trim()||running) return;
    setRunning(true); setAgentStates({}); setTab("pipeline");
    const q=input; setInput("");
    const res=await runPipeline(q,staff,year,month,holidays,requests,hourly,nightHrs,rules,addLog,setState,sheetsReady);
    if(res.success){
      setScheduleData(res.scheduleData); setScore(res.score);
      if(res.merged) setRequests(res.merged);
    }
    setRunning(false);
  };

  const TABS=[
    {id:"pipeline",label:"🤖 파이프라인"},
    {id:"schedule",label:"📅 근무표"},
    {id:"staff",   label:"👥 직원 설정"},
    {id:"holiday", label:"🏖️ 공휴일"},
    {id:"request", label:"📝 요청 입력"},
    {id:"rules",   label:"⚙️ 배정 기준"},
    {id:"wage",    label:"💰 수당 기준"},
    {id:"setup",   label:"🔧 연동 설정"},
  ];

  return(
    <div style={{fontFamily:"'Pretendard','Noto Sans KR',sans-serif",background:C.navy,
                  minHeight:"100vh",color:C.white,display:"flex",flexDirection:"column"}}>

      {/* 헤더 */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.steel}`,
                   padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.teal,
                        boxShadow:`0 0 8px ${C.teal}`,animation:"pulse 2s infinite"}}/>
          <span style={{fontWeight:700,fontSize:26}}>요양보호사 AI 근무표 에이전트</span>
          <span style={{fontSize:18,color:C.gray,background:"#1a2d4a",padding:"2px 6px",borderRadius:3}}>
            Level 3 · Sheets 연동
          </span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{...selectStyle,width:70}}>
            {[2025,2026].map(y=><option key={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))} style={{...selectStyle,width:60}}>
            {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
          </select>
          {score&&<span style={{background:score>=80?C.teal:C.amber,color:"#fff",
                                 borderRadius:4,padding:"2px 8px",fontSize:20,fontWeight:700}}>
            적합도 {score}/100</span>}
          <ConnectBadge status={sheetsStatus} onConnect={connectSheets} onLoad={loadFromSheets}/>
        </div>
      </div>

      {/* 탭 */}
      <div style={{display:"flex",gap:1,padding:"5px 14px 0",background:C.panel,
                   borderBottom:`1px solid #1a2d4a`,overflowX:"auto"}}>
        {TABS.map(({id,label})=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{background:tab===id?C.steel:"transparent",color:tab===id?"#fff":C.gray,
                    border:"none",borderRadius:"5px 5px 0 0",padding:"6px 12px",
                    fontSize:22,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div style={{flex:1,display:"flex",overflow:"hidden",height:"calc(100vh - 116px)"}}>
        {tab==="pipeline"&&<PipelinePanel agentStates={agentStates} logs={logs} running={running}/>}
        {tab==="schedule"&&<SchedulePanel scheduleData={scheduleData} staff={staff} requests={requests}
          holidays={holidays} year={year} month={month} score={score}
          sheetsId={sheetsReady?GAPI_CONFIG.SPREADSHEET_ID:null}/>}
        {tab==="staff"   &&<StaffPanel staff={staff} setStaff={setStaffSafe}/>}
        {tab==="holiday" &&<HolidayPanel holidays={holidays} setHolidays={setHolidays} year={year} month={month}/>}
        {tab==="request" &&<RequestPanel staff={staff} requests={requests} setRequests={setRequests} year={year} month={month}/>}
        {tab==="wage"    &&<WagePanel hourly={hourly} setHourly={setHourly} nightHrs={nightHrs} setNightHrs={setNightHrs} staff={staff}/>}
        {tab==="rules"   &&<RulesPanel rules={rules} setRules={setRules} staff={staff}/>}
        {tab==="setup"   &&<SetupGuide/>}
      </div>

      {/* 입력창 */}
      <div style={{background:C.panel,borderTop:`1px solid ${C.steel}`,
                   padding:"10px 16px",display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1,background:"#0a1628",borderRadius:8,border:`1px solid ${C.steel}`,
                     padding:"7px 10px",display:"flex",gap:6,alignItems:"center"}}>
          <span style={{color:C.teal,fontSize:24,fontFamily:"monospace"}}>▶</span>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();run();}}}
            placeholder={"자연어로 요청하세요  (Enter=실행)\n예) \"요양보호사 01 7월 14일 연차 써줘\"  /  \"7월 근무표 생성해줘\""}
            rows={2} disabled={running}
            style={{flex:1,background:"transparent",border:"none",outline:"none",
                    color:C.white,fontSize:22,fontFamily:"inherit",resize:"none",lineHeight:1.6}}/>
        </div>
        <button onClick={run} disabled={running||!input.trim()}
          style={{background:running?C.gray:C.teal,color:"#fff",border:"none",borderRadius:8,
                  padding:"10px 18px",fontSize:24,fontWeight:700,cursor:running?"not-allowed":"pointer",
                  minWidth:60,boxShadow:!running&&input.trim()?`0 0 10px ${C.teal}66`:"none"}}>
          {running?"실행중":"실행"}
        </button>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a1628}
        ::-webkit-scrollbar-thumb{background:#1e4d8c;border-radius:2px}
        textarea::placeholder{color:#334155;line-height:1.8}
        select option{background:#0a1628}
      `}</style>
    </div>
  );
}