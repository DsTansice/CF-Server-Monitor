/**
 * 后台入口 URL 归一化。
 *
 * 必须在 createWebHashHistory() 之前执行：vue-router 用 location.pathname + location.search
 * 作为 base，并在创建的那一刻一次性快照初始路由；此后任何 history.replaceState() 都不会派发
 * popstate，Router 不会跟进。结果是"地址栏写着后台、渲染的却是看板"，看板在私有站点拿到 401 后
 * 又按 pathname 判定"已在后台"而 reload，形成刷新循环。
 *
 * 归一化后形成不变量：只要 pathname 是 /admin，hash 必定是 #/admin*，
 * 于是 401 处理器的 pathname 判定成立，刷新必然落回后台而不会循环。
 *
 * 兼容说明：第三方主题的入口按 theme-develop.md 的历史约定写作 /admin#admin，
 * 该旧式同样解析为后台路由，这里接受它并把地址栏收敛到 #/admin 形式。
 */

const ADMIN_PATH = '/admin'
const ADMIN_HASH = '#/admin'

// 私有站跳转、主题入口共用的标准后台地址
export const ADMIN_ENTRY_URL = `${ADMIN_PATH}${ADMIN_HASH}`

export const isAdminPath = (pathname) => {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  return path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`)
}

// 只认 /admin 这一个 hash 路由：后缀必须为空或以 ? 开头，
// 否则 #/administrator、#adminx 这类前缀误匹配会拼出不存在的路由，渲染成空白页
const isAdminHash = (hash) => hash === ADMIN_HASH || hash.startsWith(`${ADMIN_HASH}?`)
const isLegacyAdminHash = (hash) => hash === '#admin' || hash.startsWith('#admin?')

/**
 * 计算后台入口需要归一化成的 URL。
 * @returns {string|null} 需要改写时返回目标 URL，已经处于标准形式时返回 null
 */
export const resolveAdminEntryUrl = ({ pathname = '', search = '', hash = '' } = {}) => {
  if (!isAdminPath(pathname)) return null

  // 旧式 hash 的后缀是 ?apiIndex=1 之类的查询参数，必须保留。
  // 无 hash、以及 pathname 是 /admin 时的其它 hash 都留空后缀，一律按后台入口处理：
  // 看板与详情页有各自的域名根路径入口（/#/、/#/server/:id），不挂在 /admin 下
  let suffix = ''
  if (isAdminHash(hash)) suffix = hash.slice(ADMIN_HASH.length)
  else if (isLegacyAdminHash(hash)) suffix = hash.slice('#admin'.length)
  // 查询参数整体搬进 hash：hash history 会把 location.search 并入 base，
  // 而它之后只用 '#'+path 写地址栏，留在 search 里的 ?github_bound=1 永远清不掉
  if (search && !suffix) suffix += search

  const target = `${ADMIN_PATH}${ADMIN_HASH}${suffix}`
  return target === `${pathname}${search}${hash}` ? null : target
}

export const normalizeAdminEntryUrl = () => {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  const target = resolveAdminEntryUrl({ pathname, search, hash })
  if (!target) return
  // state 传 null：随后创建的 vue-router 会重建一份与 URL 一致的 history.state
  window.history.replaceState(null, '', target)
}
