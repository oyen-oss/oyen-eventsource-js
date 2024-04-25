SRCS = $(wildcard lib/**)

all: test dist

.PHONY: clean
clean: node_modules
	pnpm exec tsc -b --clean
	rm -rf dist

.PHONY: test
test: node_modules
	pnpm exec tsc
	NODE_OPTIONS=--experimental-vm-modules pnpm exec vitest

node_modules: package.json
	pnpm install

dist: node_modules tsconfig.json $(SRCS)
	pnpm exec tsc

.PHONY: dist-watch
dist-watch: node_modules
	pnpm exec tsc -w --preserveWatchOutput

.PHONY: pretty
pretty: node_modules
	pnpm exec eslint --fix . || true
	pnpm exec prettier --write .