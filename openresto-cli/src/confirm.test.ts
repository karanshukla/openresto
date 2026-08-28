import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { confirmOrExit, ConfirmationRequiredError } from "./confirm.js";

function fakeWritable(): Writable {
  return new Writable({
    write(_chunk, _enc, callback) {
      callback();
    },
  });
}

describe("confirmOrExit", () => {
  test("--yes proceeds without touching stdin at all", async () => {
    await assert.doesNotReject(() =>
      confirmOrExit("Destroy something", true, { isTTY: false }),
    );
  });

  test("no --yes and no TTY (piped/CI) is refused rather than hanging on a prompt", async () => {
    await assert.rejects(
      () => confirmOrExit("Destroy something", false, { isTTY: false }),
      ConfirmationRequiredError,
    );
  });

  test("the refusal message mentions --yes so the caller knows how to proceed non-interactively", async () => {
    await assert.rejects(
      () => confirmOrExit("Destroy something", false, { isTTY: false }),
      /--yes/,
    );
  });

  test("an interactive 'y' answer proceeds", async () => {
    const stdin = Readable.from(["y\n"]);
    await assert.doesNotReject(() =>
      confirmOrExit("Destroy something", false, {
        isTTY: true,
        stdin,
        stdout: fakeWritable(),
      }),
    );
  });

  test("an interactive 'yes' answer proceeds", async () => {
    const stdin = Readable.from(["yes\n"]);
    await assert.doesNotReject(() =>
      confirmOrExit("Destroy something", false, {
        isTTY: true,
        stdin,
        stdout: fakeWritable(),
      }),
    );
  });

  test("an interactive empty/other answer is refused", async () => {
    const stdin = Readable.from(["\n"]);
    await assert.rejects(
      () =>
        confirmOrExit("Destroy something", false, {
          isTTY: true,
          stdin,
          stdout: fakeWritable(),
        }),
      ConfirmationRequiredError,
    );
  });

  test("an interactive 'n' answer is refused", async () => {
    const stdin = Readable.from(["n\n"]);
    await assert.rejects(
      () =>
        confirmOrExit("Destroy something", false, {
          isTTY: true,
          stdin,
          stdout: fakeWritable(),
        }),
      ConfirmationRequiredError,
    );
  });
});
