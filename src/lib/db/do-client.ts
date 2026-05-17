/// <reference types="@cloudflare/workers-types" />
import { AsyncLocalStorage } from "node:async_hooks";
import type { MainDO } from "../../do/main-do";

export interface EnvWithMainDo {
  MAIN_DO: DurableObjectNamespace<MainDO>;
}

interface RuntimeStore {
  env: EnvWithMainDo;
}

export const runtimeAls = new AsyncLocalStorage<RuntimeStore>();

export function getDoStubFromEnv(env: EnvWithMainDo): DurableObjectStub<MainDO> {
  const id = env.MAIN_DO.idFromName("main");
  return env.MAIN_DO.get(id);
}

export function getDoStub(): DurableObjectStub<MainDO> {
  const store = runtimeAls.getStore();
  if (!store) {
    throw new Error(
      "DO stub requested outside of a request scope. runtimeMiddleware must wrap the request.",
    );
  }
  return getDoStubFromEnv(store.env);
}
