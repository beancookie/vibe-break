local plugin = {}

plugin.name = "juejin"
plugin.url = "https://juejin.cn/rss"
plugin.method = "GET"
plugin.headers = {
  ["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

function plugin.parse(response)
  local items = {}
  for item in string.gmatch(response, "<item>(.-)</item>") do
    local title = item:match("<title>(.-)</title>")
    local link = item:match("<link>(.-)</link>")
    if title and title ~= "" then
      title = title:gsub("<!%[CDATA%[(.-)%]%]>", "%1")
      table.insert(items, {
        title = title,
        link = link or "",
        source = "掘金"
      })
    end
  end
  return items
end

return plugin
