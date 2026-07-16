import { ourongxing, react } from "@ourongxing/eslint-config"

/** @type {any} */
const config = await ourongxing({
  type: "app",
  // 貌似不能 ./ 开头，
  ignores: ["src/routeTree.gen.ts", "imports.app.d.ts", "public/", ".vscode", "**/*.json"],
}).append(react({
  files: ["src/**"],
})).toConfigs()

config.forEach((item) => {
  const rules = item.rules
  const deprecatedRule = "react-dom/no-children-in-void-dom-elements"
  if (rules?.[deprecatedRule]) {
    rules["react-dom/no-void-elements-with-children"] = rules[deprecatedRule]
    delete rules[deprecatedRule]
  }
  if (rules?.["react/no-implicit-key"]) {
    rules["react/no-implicit-key"] = "off"
  }
})

const plugins = new Map()
config.forEach((item) => {
  Object.entries(item.plugins ?? {}).forEach(([name, plugin]) => {
    plugins.set(name, plugin)
  })
})

function splitRuleName(ruleName) {
  const parts = ruleName.split("/")
  if (parts.length < 2) return
  const pluginName = ruleName.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
  return [pluginName, parts.slice(ruleName.startsWith("@") ? 2 : 1).join("/")]
}

config.forEach((item) => {
  Object.keys(item.rules ?? {}).forEach((ruleName) => {
    const parsed = splitRuleName(ruleName)
    if (!parsed) return
    const [pluginName, pluginRuleName] = parsed
    const plugin = plugins.get(pluginName)
    if (plugin && !plugin.rules?.[pluginRuleName]) {
      delete item.rules[ruleName]
    }
  })
})

export default config
