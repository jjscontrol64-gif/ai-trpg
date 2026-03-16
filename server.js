import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GM 시스템 프롬프트 생성
function buildGmSystemPrompt(gameState) {
  return `당신은 톨킨 풍 중세 판타지 세계의 게임 마스터입니다.
자연스러운 한국어로, 고풍스럽고 서사적인 문체로 내레이션하세요.

[현재 게임 상태]
${JSON.stringify(gameState, null, 2)}

[규칙]
- 플레이어의 모든 행동에 반드시 구체적인 결과를 부여하세요.
- HP가 0이 되면 게임 오버 내레이션 후 isGameOver를 true로 설정하세요.
- 아이템 획득·소비·HP 변화가 있을 경우 반드시 newState에 반영하세요.
- turn은 매 응답마다 1씩 증가시키세요.
- history 필드는 newState에 포함하지 마세요. (서버에서 관리)
- 응답은 반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 포함하지 마세요.

[응답 형식]
{
  "narration": "내레이션 텍스트 (플레이어에게 보여줄 내용)",
  "newState": {
    "player": { "name": "...", "hp": 0~100, "maxHp": 100, "inventory": [], "gold": 0 },
    "world": { "location": "...", "chapter": 1, "flags": {} },
    "turn": 1,
    "isGameOver": false
  }
}`;
}

// TRPG 게임 턴 처리
app.post('/api/game', async (req, res) => {
  const { action, gameState, history } = req.body;

  if (!action || typeof action !== 'string' || action.trim().length === 0) {
    return res.status(400).json({ error: '행동을 입력해주세요.' });
  }

  if (!gameState) {
    return res.status(400).json({ error: '게임 상태가 올바르지 않습니다.' });
  }

  // history는 배열이어야 하며, Claude API messages 형식을 따름
  const messages = Array.isArray(history) ? [...history] : [];
  messages.push({ role: 'user', content: action.trim() });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: buildGmSystemPrompt(gameState),
      messages,
    });

    const rawText = message.content[0].text;

    // JSON 파싱 — 실패 시 에러 반환
    let parsed;
    try {
      // 응답이 ```json ... ``` 으로 감싸진 경우 대응
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        rawText.match(/```\s*([\s\S]*?)\s*```/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
    } catch {
      console.error('JSON 파싱 실패:', rawText);
      return res.status(500).json({ error: 'GM의 응답을 해석하지 못하였습니다. 다시 시도해주세요.' });
    }

    res.json({
      narration: parsed.narration,
      newState: parsed.newState,
    });
  } catch (err) {
    console.error('Claude API 오류:', err.message);
    res.status(500).json({ error: 'API 호출 중 오류가 발생하였습니다. API 키를 확인해주세요.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI TRPG 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
