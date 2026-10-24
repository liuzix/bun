import { describe, expect, test } from "bun:test";
import { itBundled } from "../expectBundled";
describe("bundler", () => {
  for (const minifySyntax of [false, true]) {
    itBundled(`react-compiler/ReactiveControlFlowAcrossTryCatch-syntax=${minifySyntax}`, {
      files: {
        "/entry.jsx": /* jsx */ `
          import { use, useMemo } from "react";

          function parse(text) {
            if (text.startsWith("!")) throw new Error("cannot parse " + text);
            return text;
          }
          function alwaysThrows() {
            throw new Error("always");
          }
          function neverThrows() {}
          function guard(box) {
            if (box.bad) throw new Error("bad");
          }
          function throwA() {
            throw new Error("A");
          }
          function throwB() {
            throw new Error("B");
          }
          const mark = it => {
            it.ok = true;
          };
          const box = { bad: true, value: 1 };

          function AssignedInCatch(props) {
            let status = "ok";
            try {
              parse(props.text);
            } catch {
              status = "failed";
            }
            return <div>{status}</div>;
          }

          function ReturnedFromUseMemo({ text }) {
            const status = useMemo(() => {
              try {
                parse(text);
                return "ok";
              } catch {
                return "failed";
              }
            }, [text]);
            return <div>{status}</div>;
          }

          // The element built in the handler is memoized on the caught value.
          function CaughtValue(props) {
            let element;
            try {
              parse(props.text);
              element = <b>ok</b>;
            } catch (error) {
              element = <i>{error.message}</i>;
            }
            return <div>{element}</div>;
          }

          // A reactive scope spans the whole try statement. The catch parameter
          // is only bound inside the clause, so that scope cannot depend on it.
          function ScopeAroundTry(props) {
            let element = null;
            try {
              props.strict && parse(props.text);
            } catch (error) {
              element = <i>{error.message}</i>;
            }
            return <div>{element}</div>;
          }

          // The closure captures a handler local that came from the caught value.
          // (One that captures the catch parameter itself is not compiled.)
          function ClosureInCatch(props) {
            let read = () => "none";
            try {
              parse(props.text);
            } catch (error) {
              const message = error.message;
              read = () => message;
            }
            return <div>{read()}</div>;
          }

          // The handler reads a local whose value depends on which call threw.
          function ReadInCatch(props) {
            let stage = "first";
            let failedAt = "none";
            try {
              parse(props.first);
              stage = "second";
              parse(props.second);
            } catch {
              failedAt = stage;
            }
            return <div>{failedAt}</div>;
          }

          // No call that can enter the outer handler reads a reactive value, but
          // alwaysThrows() only runs when the inner handler does.
          function NestedTry(props) {
            let status = "ok";
            try {
              try {
                parse(props.text);
              } catch {
                alwaysThrows();
              }
              neverThrows();
            } catch {
              status = "failed";
            }
            return <div>{status}</div>;
          }

          // Each call in an arm can leave for the handler, so the end of the arm
          // depends on the call before it, and only through that on the if.
          function IfInTry(props) {
            let side = "none";
            try {
              if (props.left) {
                neverThrows();
                side = "left";
              } else {
                neverThrows();
                side = "right";
              }
            } catch {
              return null;
            }
            return <div>{side}</div>;
          }

          // Both sides of the try statement split on a static test before they
          // join again, so no path into the join starts at the throw itself.
          function SplitOnBothSides({ text }) {
            const status = useMemo(() => {
              try {
                parse(text);
                if (globalThis.isMobile) return "ok on mobile";
                return "ok";
              } catch {
                if (globalThis.isMobile) return "failed on mobile";
                return "failed";
              }
            }, [text]);
            return <div>{status}</div>;
          }

          // The try block reads nothing reactive, but how often it runs does
          // depend on the props, and its handler leaves the loop body early.
          function StaticTryInLoop(props) {
            let failures = 0;
            for (const item of props.items) {
              try {
                alwaysThrows();
              } catch {
                failures++;
                continue;
              }
            }
            return <div>{failures}</div>;
          }

          // This try block reads nothing reactive and always runs, so the local
          // its handler assigns is not a dependency.
          function NothingReactiveInTry(props) {
            let staticStatus = "ok";
            try {
              parse(globalThis.staticText);
            } catch {
              staticStatus = "failed";
            }
            return <div title={props.title}>{staticStatus}</div>;
          }

          // Only the handler returns, so nothing is after the try statement for it to join.
          function CaughtValueWhenOnlyTheHandlerReturns(props) {
            try {
              parse(props.text);
            } catch (error) {
              return <div>{error.message}</div>;
            }
            throw new Error("not caught");
          }

          // Each arm ends with the store to \`side\`, which can leave for the handler. So the end of the
          // statement depends on that store, and only through it on \`props.left\`.
          function TernaryInTry(props) {
            let side;
            try {
              side = props.left ? "left" : "right";
            } catch {
              return null;
            }
            return <div>{side}</div>;
          }

          // The second call runs under a test that is not reactive, which runs under a throw that is.
          function StaticIfAfterAThrow(props) {
            let stage = "first";
            try {
              parse(props.first);
              if (globalThis.staticText) {
                stage = "second";
                parse(props.second);
              }
            } catch {
              return <div>{"failed at " + stage}</div>;
            }
            return <div>{"ok at " + stage}</div>;
          }

          // The throw is reactive only after the statement behind it has run once.
          function ThrowThatALaterStatementMakesReactive(props) {
            const box = { bad: false };
            let turns = 0;
            for (let i = 0; i < 3; i++) {
              try {
                guard(box);
              } catch {
                break;
              }
              turns = turns + 1;
              box.bad = props.bad;
            }
            return <div>{turns}</div>;
          }

          // The function is called inside the try. Only its branch decides whether the handler runs.
          function TernaryInCalledFunctionInTry(props) {
            let status = "ok";
            try {
              (() => (props.strict ? parse(props.text) : 0))();
            } catch {
              status = "failed";
            }
            return <div>{status}</div>;
          }

          // The only reactive read in this try block is the function that \`read\` is declared with. Neither
          // the function expression nor the declaration can throw, so no throw in the block is reactive.
          function ReactiveReadThatCannotThrow(props) {
            let staticLabel = "ok";
            try {
              const read = () => props.title;
              parse(globalThis.staticText);
              if (globalThis.stop) return { read: () => read() };
            } catch {
              staticLabel = "failed";
            }
            return <div>{staticLabel}</div>;
          }

          // Which of the two calls throws into the outer handler is decided by whether the inner try threw.
          function CaughtValueInNestedTry(props) {
            try {
              try {
                parse(props.text);
              } catch {
                throwA();
              }
              throwB();
            } catch (error) {
              return <i>{error.message}</i>;
            }
            return null;
          }

          // A destructuring parameter binds what is caught too.
          function CaughtValueInAPattern(props) {
            try {
              parse(props.text);
            } catch ({ message }) {
              return <i>{message}</i>;
            }
            return <b>ok</b>;
          }

          // Nothing reactive decides what this try block throws, so what it catches is no dependency: the
          // element in the handler is made once.
          function CaughtByStaticTry(props) {
            let element = null;
            try {
              alwaysThrows();
            } catch (error) {
              element = <i>{error}</i>;
            }
            return <div title={props.title}>{element}</div>;
          }

          // The props decide whether these try blocks run, and not what they throw when they run.
          function CaughtByStaticTryAfterReactiveReturn(props) {
            if (props.loading) return null;
            let element = null;
            try {
              alwaysThrows();
            } catch (error) {
              element = <i>{error}</i>;
            }
            return <div>{element}</div>;
          }
          function CaughtByStaticTryUnderReactiveIf(props) {
            let element = null;
            if (props.on) {
              try {
                alwaysThrows();
              } catch (error) {
                element = <i>{error}</i>;
              }
            }
            return <div>{element}</div>;
          }

          // The store runs only when the call before it did not throw.
          function MutatedAfterAThrow(props) {
            const info = { ok: false };
            try {
              parse(props.text);
              info.ok = true;
            } catch {}
            return <div>{info.ok ? "ok" : "failed"}</div>;
          }

          // Two loads are ahead of the call that mutates. Each can leave for the handler, so the call
          // depends on the throw only through them.
          function MutatedByACallAfterAThrow(props) {
            const info = { ok: false };
            try {
              parse(props.text);
              mark(info);
            } catch {}
            return <div>{info.ok ? "ok" : "failed"}</div>;
          }

          // Nothing reactive decides whether this store runs.
          function MutatedInAStaticTry(props) {
            const staticInfo = { ok: false };
            try {
              parse(globalThis.staticText);
              staticInfo.ok = true;
            } catch {}
            return <div title={props.title}>{staticInfo.ok ? "ok" : "failed"}</div>;
          }

          // \`use\` is a source of reactivity with no operand that is one.
          function UseInTry() {
            let status = "ok";
            try {
              use(box);
            } catch {
              status = "failed";
            }
            return <div>{status}</div>;
          }

          // The mangler makes one expression statement of the try block, and the compiler then compiles
          // this function.
          function AssignedAroundAThrow(props) {
            let a = "";
            try {
              parse(props.text);
              a = a + "1";
            } catch {
              a = a + "2";
            }
            return <div>{a}</div>;
          }

          // A branch under a reactive branch decides reactively by itself only in a function that has a
          // \`catch\`. The two pick the same value, so neither is wrong.
          function StaticPick(props) {
            if (props.on) {
              let staticPick;
              if (globalThis.staticText) staticPick = "a";
              else staticPick = "b";
              return <div>{staticPick}</div>;
            }
            return null;
          }
          function StaticPickBesideATry(props) {
            try {
              neverThrows();
            } catch {}
            if (props.on) {
              let pickBesideATry;
              if (globalThis.staticText) pickBesideATry = "a";
              else pickBesideATry = "b";
              return <div>{pickBesideATry}</div>;
            }
            return null;
          }

          function text(node) {
            if (node instanceof Error) return node.message;
            if (Array.isArray(node)) return node.map(text).join("");
            if (node !== null && typeof node === "object") return text(node.props.children);
            return String(node);
          }
          function renders(Component, ...renderProps) {
            const results = renderProps.map(props => {
              globalThis.memoCacheOwner = Component;
              const render = () => {
                try {
                  return Component(props);
                } catch (error) {
                  return "threw " + error.message;
                }
              };
              const first = render();
              // The same props again: when no dependency has changed, the memo blocks give the same element.
              const reused = render() === first ? "" : " (not reused)";
              return (typeof first === "string" ? first : text(first)) + reused;
            });
            // A component the compiler skipped never asks for a cache.
            const compiled = globalThis.memoCaches?.has(Component) ? "memoized" : "not compiled";
            console.log(Component.name + " (" + compiled + "): " + results.join(", "));
          }

          globalThis.staticText = "static";
          const texts = [{ text: "!a" }, { text: "b" }, { text: "!c" }, { text: "d" }];
          renders(AssignedInCatch, ...texts);
          renders(ReturnedFromUseMemo, ...texts);
          renders(CaughtValue, ...texts);
          renders(
            ScopeAroundTry,
            { strict: true, text: "!a" },
            { strict: false, text: "!a" },
            { strict: true, text: "!c" },
            { strict: true, text: "d" },
          );
          renders(ClosureInCatch, ...texts);
          renders(
            ReadInCatch,
            { first: "a", second: "b" },
            { first: "!a", second: "b" },
            { first: "a", second: "!b" },
            { first: "a", second: "b" },
          );
          renders(NestedTry, ...texts);
          renders(IfInTry, { left: true }, { left: false }, { left: true }, { left: false });
          renders(SplitOnBothSides, ...texts);
          renders(StaticTryInLoop, { items: [] }, { items: [1, 2] }, { items: [1] }, { items: [] });
          renders(NothingReactiveInTry, { title: "a" }, { title: "b" });
          renders(CaughtValueWhenOnlyTheHandlerReturns, ...texts);
          renders(TernaryInTry, { left: true }, { left: false }, { left: true }, { left: false });
          renders(
            StaticIfAfterAThrow,
            { first: "!a", second: "b" },
            { first: "a", second: "!b" },
            { first: "a", second: "b" },
            { first: "!a", second: "b" },
          );
          renders(ThrowThatALaterStatementMakesReactive, { bad: false }, { bad: true }, { bad: false });
          renders(
            TernaryInCalledFunctionInTry,
            { strict: true, text: "!a" },
            { strict: false, text: "!a" },
            { strict: true, text: "c" },
            { strict: true, text: "!d" },
          );
          renders(ReactiveReadThatCannotThrow, { title: "a" }, { title: "b" });
          renders(CaughtValueInNestedTry, ...texts);
          renders(CaughtValueInAPattern, ...texts);
          renders(CaughtByStaticTry, { title: "a" }, { title: "b" });
          const loading = [{ loading: true }, { loading: false }, { loading: true }, { loading: false }];
          renders(CaughtByStaticTryAfterReactiveReturn, ...loading);
          const on = [{ on: true }, { on: false }, { on: true }];
          renders(CaughtByStaticTryUnderReactiveIf, ...on);
          renders(MutatedAfterAThrow, ...texts);
          renders(MutatedByACallAfterAThrow, ...texts);
          renders(MutatedInAStaticTry, { title: "a" }, { title: "b" });
          renders(UseInTry, {});
          box.bad = false;
          renders(UseInTry, {});
          box.bad = true;
          renders(UseInTry, {});
          renders(AssignedAroundAThrow, ...texts);
          renders(StaticPick, ...on);
          renders(StaticPickBesideATry, ...on);
        `,
        "/node_modules/react/package.json": `{"name":"react","main":"./index.js"}`,
        "/node_modules/react/index.js": /* js */ `
          exports.useMemo = callback => callback();
          exports.use = box => {
            if (box.bad) throw new Error("bad");
            return box.value;
          };
        `,
        "/node_modules/react/jsx-runtime.js": `exports.jsx = exports.jsxs = (type, props) => ({ type, props });`,
        "/node_modules/react/jsx-dev-runtime.js": `exports.jsxDEV = (type, props) => ({ type, props });`,
        // One cache for each component function stands in for the cache React keeps for each component instance.
        "/node_modules/react/compiler-runtime.js": /* js */ `
          const caches = (globalThis.memoCaches = new Map());
          exports.c = size => {
            const owner = globalThis.memoCacheOwner;
            let cache = caches.get(owner);
            if (cache === undefined) {
              cache = new Array(size).fill(Symbol.for("react.memo_cache_sentinel"));
              caches.set(owner, cache);
            }
            return cache;
          };
        `,
      },
      reactCompiler: !process.env.PLAIN,
      target: "browser",
      // Both print the same.
      backend: minifySyntax ? "api" : "cli",
      minifySyntax,
      run: {
        validate({ stdout }) {
          console.log("DUMP-syntax=" + minifySyntax + "\n" + stdout + "ENDDUMP");
        },
      },
      onAfterBundle(api) {
        const out = api.readFile("/out.js");
        if (process.env.DUMP_OUT) require("fs").writeFileSync(process.env.DUMP_OUT + "/syntax=" + minifySyntax + ".js", out);
      },
    });
  }

  // Not fixed: the compiler puts the body of a function that a `try` block calls in the place of the call, and the blocks
  // that it moves there have no edge to the handler. A throw in them is no branch, so what depends on it is not reactive.
  // When nothing else in the `try` block can throw, the `catch` is gone from the output: the last component throws.
  // Upstream 1.0.0 does the same.
  itBundled("react-compiler/WhatDependsOnAThrowInACalledFunctionIsReactive", {
    todo: true,
    files: {
      "/entry.jsx": /* jsx */ `
        const check = text => {
          if (text.startsWith("!")) throw new Error(text);
          return text;
        };
        function Valid(props) {
          let valid = true;
          try {
            (() => (globalThis.always ? (check(props.text), 1) : 0))();
          } catch {
            valid = false;
          }
          return <div>{valid ? "yes" : "no"}</div>;
        }
        function ValidWithAStatement(props) {
          let valid = true;
          try {
            (() => {
              if (globalThis.always) check(props.text);
              return 1;
            })();
          } catch {
            valid = false;
          }
          return <div>{valid ? "yes" : "no"}</div>;
        }
        function Caught(props) {
          try {
            (() => {
              if (props.strict) check(props.text);
            })();
          } catch (e) {
            return <b>caught</b>;
          }
          return <i>ok</i>;
        }
        const render = (component, props) => {
          globalThis.rendering = component;
          try {
            const it = component(props);
            return it.t + " " + it.p.children;
          } catch (e) {
            return "threw " + e.message;
          }
        };
        globalThis.always = true;
        console.log(["1", "!", "2"].map(text => render(Valid, { text })).join(", "));
        console.log(["1", "!", "2"].map(text => render(ValidWithAStatement, { text })).join(", "));
        console.log(["a", "!b", "c"].map(text => render(Caught, { strict: true, text })).join(", "));
      `,
      "/node_modules/react/jsx-runtime.js": `exports.jsx = (t, p) => ({ t, p }); exports.jsxs = exports.jsx;`,
      "/node_modules/react/jsx-dev-runtime.js": `exports.jsxDEV = (t, p) => ({ t, p });`,
      "/node_modules/react/compiler-runtime.js": `
        const caches = new Map();
        exports.c = n => {
          if (!caches.has(globalThis.rendering))
            caches.set(globalThis.rendering, new Array(n).fill(Symbol.for("react.memo_cache_sentinel")));
          return caches.get(globalThis.rendering);
        };
      `,
      "/node_modules/react/package.json": `{"name":"react","main":"./index.js"}`,
    },
    reactCompiler: !process.env.PLAIN,
    target: "browser",
    backend: "cli",
    run: { stdout: "div yes, div no, div yes\ndiv yes, div no, div yes\ni ok, b caught, i ok" },
    onAfterBundle(api) {
      expect(api.readFile("/out.js")).toContain("react.memo_cache_sentinel");
    },
  });

  // Not fixed: in a function with no `catch`, a branch decides reactively only by its own test. So a store under a test
  // that is not reactive, which runs under one that is, leaves its object as it was on the first render. Upstream 1.0.0
  // does the same.
  itBundled("react-compiler/WhatDependsOnABranchUnderAReactiveBranchIsReactive", {
    todo: true,
    files: {
      "/entry.jsx": /* jsx */ `
        function ClassList(props) {
          const classes = ["btn"];
          if (props.active) {
            if (globalThis.platform === "ios") classes.push("active-ios");
            else classes.push("active");
          }
          return <div>{classes.join(" ")}</div>;
        }
        function Mutated(props) {
          const info = { on: false };
          if (props.on) {
            if (globalThis.always) info.on = true;
          }
          return <div>{info.on ? "on" : "off"}</div>;
        }
        function StaticBreakInReactiveLoop(props) {
          let count = 0;
          for (const item of props.items) {
            if (globalThis.stop) break;
            count = count + 1;
          }
          return <div>{count}</div>;
        }
        function LabeledBreakUnderReactiveIf(props) {
          let state = "none";
          block: {
            if (props.on) {
              if (globalThis.stop) {
                state = "on, stopped";
                break block;
              }
              state = "on";
              break block;
            } else {
              if (globalThis.stop) {
                state = "off, stopped";
                break block;
              }
              state = "off";
              break block;
            }
          }
          return <div>{state}</div>;
        }
        const render = (component, props) => {
          globalThis.rendering = component;
          return component(props).p.children;
        };
        globalThis.always = true;
        globalThis.platform = "ios";
        console.log([true, false, true].map(active => render(ClassList, { active })).join(", "));
        console.log([true, false, true].map(on => render(Mutated, { on })).join(", "));
        console.log([[1], [1, 2], []].map(items => render(StaticBreakInReactiveLoop, { items })).join(", "));
        console.log([true, false, true].map(on => render(LabeledBreakUnderReactiveIf, { on })).join(", "));
      `,
      "/node_modules/react/jsx-runtime.js": `exports.jsx = (t, p) => ({ t, p }); exports.jsxs = exports.jsx;`,
      "/node_modules/react/jsx-dev-runtime.js": `exports.jsxDEV = (t, p) => ({ t, p });`,
      "/node_modules/react/compiler-runtime.js": `
        const caches = new Map();
        exports.c = n => {
          if (!caches.has(globalThis.rendering))
            caches.set(globalThis.rendering, new Array(n).fill(Symbol.for("react.memo_cache_sentinel")));
          return caches.get(globalThis.rendering);
        };
      `,
      "/node_modules/react/package.json": `{"name":"react","main":"./index.js"}`,
    },
    reactCompiler: !process.env.PLAIN,
    target: "browser",
    backend: "cli",
    run: { stdout: "btn active-ios, btn, btn active-ios\non, off, on\n1, 2, 0\non, off, on" },
    onAfterBundle(api) {
      expect(api.readFile("/out.js")).toContain("react.memo_cache_sentinel");
    },
  });

});
