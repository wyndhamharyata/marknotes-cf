/// <reference types="@cloudflare/workers-types" />
import { AsyncLocalStorage } from "node:async_hooks";
import type { MainDO } from "../../do/main-do";

export interface EnvWithMainDo {
  MAIN_DO?: DurableObjectNamespace<MainDO>;
}

export type StubLike = DurableObjectStub<MainDO>;

interface RuntimeStore {
  env: EnvWithMainDo;
  // Null during build-time prerender — pages that never call getDoStub() are fine.
  stub: StubLike | null;
}

export const runtimeAls = new AsyncLocalStorage<RuntimeStore>();

export function getDoStubFromEnv(env: EnvWithMainDo): StubLike {
  if (!env.MAIN_DO) throw new Error("MAIN_DO binding missing on env.");
  return env.MAIN_DO.get(env.MAIN_DO.idFromName("main"));
}

export function getDoStub(): StubLike {
  const store = runtimeAls.getStore();
  if (!store) throw new Error("getDoStub() called outside runtimeMiddleware scope.");
  if (!store.stub) throw new Error("DO stub unavailable (no MAIN_DO + not in dev).");
  return store.stub;
}
