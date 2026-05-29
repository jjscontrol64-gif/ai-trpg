"use client";

// 던전 강하 다이어그램 (The Descent)
// 대문 왼쪽 패널의 부제목과 특징 카드 사이 공백을 채우는 정적/장식 컴포넌트.
// 입구 C6에서 3개 층을 강하하는 모습을 CSS 도형(다이아몬드 노드, 스파인, 룸 그리드)으로 표현한다.

const MONO = '"Cascadia Code", "Consolas", monospace';
const SERIF = 'Georgia, "Times New Roman", serif';

interface Floor {
  name: string;
  tag: string;
  boss: string;
  bossCell: [number, number]; // [col, row]
}

const FLOORS: Floor[] = [
  { name: "1층", tag: "UPPER VAULTS", boss: "리치 · Lich", bossCell: [4, 0] },
  { name: "2층", tag: "THE INFERNAL", boss: "발록 · Balrog", bossCell: [1, 1] },
  { name: "최하층", tag: "DRAGON'S MAW", boss: "레드드래곤 · Red Dragon", bossCell: [2, 1] },
];

// 5열 × 2행 룸 그리드. boss 좌표 셀만 골드로 강조한다.
function RoomGrid({ boss, cols = 5, rows = 2 }: { boss: [number, number]; cols?: number; rows?: number }) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBoss = boss[0] === c && boss[1] === r;
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: 13,
            height: 13,
            borderRadius: 3,
            background: isBoss ? "var(--accent-gold)" : "transparent",
            border: `1px solid ${isBoss ? "var(--accent-gold)" : "var(--border-color)"}`,
            boxShadow: isBoss ? "0 0 10px rgba(215, 172, 97, 0.4)" : "none",
          }}
        />,
      );
    }
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 13px)`,
        gridAutoRows: 13,
        gap: 5,
      }}
    >
      {cells}
    </div>
  );
}

export default function DescentMap() {
  return (
    <div
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: "1rem",
        background: "linear-gradient(180deg, var(--bg-card) 0%, transparent 120%)",
        padding: "22px 24px 24px",
      }}
    >
      {/* 헤더 행: The Descent (골드) + ENTRY · C6 (mono, muted) */}
      <div className="mb-[18px] flex items-baseline justify-between">
        <span className="panel-kicker" style={{ color: "var(--accent-gold)" }}>
          The Descent
        </span>
        <span
          style={{ fontFamily: MONO, fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.16em" }}
        >
          ENTRY · C6
        </span>
      </div>

      {/* 층 목록 — 위에서 아래로 강하 */}
      {FLOORS.map((floor, i) => {
        const isLast = i === FLOORS.length - 1;
        return (
          <div key={floor.name} className="flex items-stretch gap-[18px]">
            {/* 스파인: 다이아몬드 노드 + 세로 강하 라인 */}
            <div className="flex w-[22px] flex-col items-center">
              <div
                style={{
                  width: 12,
                  height: 12,
                  marginTop: 4,
                  flexShrink: 0,
                  transform: "rotate(45deg)",
                  background: "var(--bg-primary)",
                  border: "2px solid var(--accent-gold)",
                }}
              />
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    width: 2,
                    opacity: 0.5,
                    background:
                      "linear-gradient(180deg, var(--accent-gold) 0%, var(--border-color) 100%)",
                  }}
                />
              )}
            </div>

            {/* 콘텐츠: 층 정보(좌) + 룸 그리드(우) */}
            <div
              className="flex flex-1 items-center justify-between gap-4"
              style={{ paddingBottom: isLast ? 0 : 22 }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-[10px]">
                  <span
                    style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}
                  >
                    {floor.name}
                  </span>
                  <span
                    style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em" }}
                  >
                    {floor.tag}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-gold)" }}>
                  {floor.boss}
                </div>
              </div>
              <RoomGrid boss={floor.bossCell} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
