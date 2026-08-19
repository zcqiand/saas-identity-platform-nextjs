// Login lockout — M03.F01.I02
//
// 进程内失败计数器：在 LOCKOUT_WINDOW_MIN 窗口内连续 LOCKOUT_MAX_FAILS 次失败，
// 进入 LOCKOUT_COOLDOWN_MIN 冷却期，期内返回 429 ACCOUNT_LOCKED。
// Phase 6 替换为持久化（DB 或 Redis，多进程 / 重启可恢复）。
//
// 用法（/api/v1/auth/login 内）：
//   if (loginLockout.isLockedOut(username)) {
//     return NextResponse.json({ code: "ACCOUNT_LOCKED", ... }, { status: 429 });
//   }
//   ... 校验失败：
//   loginLockout.recordFailure(username);
//   ... 校验成功：
//   loginLockout.clearFailures(username);

import "server-only";

interface FailRecord {
  count: number;
  firstAt: number; // 窗口起点（首次失败时间）
  lastAt: number; // 最近一次失败
}

const WINDOW_MS_DEFAULT = 15 * 60 * 1000;
const COOLDOWN_MS_DEFAULT = 30 * 60 * 1000;
const MAX_FAILS_DEFAULT = 5;

function readMax(): number {
  const raw = process.env.LOCKOUT_MAX_FAILS;
  const n = raw ? Number(raw) : MAX_FAILS_DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : MAX_FAILS_DEFAULT;
}

function readWindowMs(): number {
  const raw = process.env.LOCKOUT_WINDOW_MIN;
  const min = raw ? Number(raw) : 15;
  return Number.isFinite(min) && min > 0 ? min * 60 * 1000 : WINDOW_MS_DEFAULT;
}

function readCooldownMs(): number {
  const raw = process.env.LOCKOUT_COOLDOWN_MIN;
  const min = raw ? Number(raw) : 30;
  return Number.isFinite(min) && min > 0 ? min * 60 * 1000 : COOLDOWN_MS_DEFAULT;
}

class LoginLockout {
  private fails = new Map<string, FailRecord>();

  /** 当前是否锁定：count >= max 且 lastAt 在 cooldown 内 */
  isLockedOut(key: string, now: number = Date.now()): boolean {
    const rec = this.fails.get(key);
    if (!rec) return false;
    const windowMs = readWindowMs();
    const cooldownMs = readCooldownMs();
    // 窗口外：失效，重置
    if (now - rec.firstAt > windowMs) {
      this.fails.delete(key);
      return false;
    }
    if (rec.count < readMax()) return false;
    return now - rec.lastAt <= cooldownMs;
  }

  /** 记录一次失败；窗口起点不滑动（与 msw handler-extra.ts 略不同 — nextjs 用「首次失败后 LOCKOUT_WINDOW_MIN 累计 N 次」） */
  recordFailure(key: string, now: number = Date.now()): void {
    const windowMs = readWindowMs();
    const rec = this.fails.get(key);
    if (!rec || now - rec.firstAt > windowMs) {
      this.fails.set(key, { count: 1, firstAt: now, lastAt: now });
      return;
    }
    rec.count += 1;
    rec.lastAt = now;
  }

  /** 登录成功后清零 */
  clearFailures(key: string): void {
    this.fails.delete(key);
  }

  /** 调试 / 测试用：读取当前失败计数（不影响锁判定） */
  debugSnapshot(key: string): { count: number; firstAt: number; lastAt: number } | undefined {
    const rec = this.fails.get(key);
    if (!rec) return undefined;
    return { ...rec };
  }
}

export const loginLockout = new LoginLockout();