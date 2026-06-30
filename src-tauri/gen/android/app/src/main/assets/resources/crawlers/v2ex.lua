local plugin = {}

plugin.name = "v2ex"
plugin.url = "https://www.v2ex.com/?tab=hot"
plugin.method = "GET"
plugin.headers = {
  ["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

function plugin.parse(response)
  local items = {}
  local ok, links = pcall(html.select, response, ".item_hot_topic_title a")
  if not ok then return items end
  for _, link in ipairs(links) do
    local title = link.text
    local href = link.href
    if title and title ~= "" then
      table.insert(items, {
        title = title,
        link = "https://www.v2ex.com" .. (href or ""),
        source = "V2EX"
      })
    end
  end
  return items
end

return plugin
