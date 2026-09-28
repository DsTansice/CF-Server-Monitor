import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADMIN_ENTRY_URL,
  isAdminEntryHash,
  isAdminPath,
  normalizeAdminEntryUrl,
  resolveAdminEntryUrl
} from '../src/frontend/router/adminEntryUrl.js'

// 复刻 vue-router createCurrentLocation 的 hash 分支（vue-router.mjs:16-26、283-288），
// 用来断言归一化后的地址确实被 hash history 解析成后台路由 —— 这正是本次修复依赖的机制。
// 返回值是 vue-router 拿到的原始 location 字符串（含 query），随后才由它拆成 path/query。
const resolveHashLocation = (href) => {
  const url = new URL(`https://monitor.example${href}`)
  const base = `${url.pathname}${url.search}#`
  const hashPos = base.indexOf('#')
  assert.ok(hashPos > -1)
  const slicePos = url.hash.includes(base.slice(hashPos)) ? base.slice(hashPos).length : 1
  let pathFromHash = url.hash.slice(slicePos)
  if (pathFromHash[0] !== '/') pathFromHash = `/${pathFromHash}`
  return pathFromHash
}

const currentUrl = ({ pathname, search = '', hash = '' }) => `${pathname}${search}${hash}`

test('后台入口归一化只在 /admin 前缀生效', () => {
  assert.equal(isAdminPath('/admin'), true)
  assert.equal(isAdminPath('/admin/'), true)
  assert.equal(isAdminPath('/admin/api'), true)
  assert.equal(isAdminPath('/'), false)
  assert.equal(isAdminPath('/administrator'), false)
  assert.equal(isAdminPath('/repo/'), false)

  assert.equal(resolveAdminEntryUrl({ pathname: '/' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/', search: '?foo=1' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/', hash: '#/' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/', hash: '#/server/1?apiIndex=1' }), null)
  // Pages/子路径部署：后台走 /#/admin，不经过 /admin 入口
  assert.equal(resolveAdminEntryUrl({ pathname: '/repo/', hash: '#/admin' }), null)
})

test('/admin 与带查询参数的回跳都归一化为标准后台地址', () => {
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin/' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?foo=1' }), '/admin#/admin?foo=1')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?state=abc&redirect_url=%2Fadmin' }), '/admin#/admin?state=abc&redirect_url=%2Fadmin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?apiIndex=1' }), '/admin#/admin?apiIndex=1')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/' }), '/admin#/admin')
})

test('/admin 下的详情页入口不被改回后台首页（刷新 / 新标签页打开都留在详情页）', () => {
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/server/1' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/server/1?apiIndex=1' }), null)
  // 裸 query 仍搬进 hash，否则 hash history 会把它吞进 base 而丢失
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?apiIndex=1', hash: '#/server/2' }), '/admin#/server/2?apiIndex=1')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin/', hash: '#/server/2' }), '/admin#/server/2')
  // 只有详情页这一段被保留，其余 hash 依旧收敛到后台入口
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/server' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/serverx/1' }), '/admin#/admin')
})

test('isAdminEntryHash 判定 /admin 下渲染的是不是后台（决定能否安全 reload）', () => {
  assert.equal(isAdminEntryHash('#/admin'), true)
  assert.equal(isAdminEntryHash('#/admin?apiIndex=1'), true)
  assert.equal(isAdminEntryHash('#admin'), true)
  assert.equal(isAdminEntryHash('#admin?apiIndex=1'), true)
  assert.equal(isAdminEntryHash('#/server/1'), false)
  assert.equal(isAdminEntryHash('#/'), false)
  assert.equal(isAdminEntryHash(''), false)
})

test('旧式 #admin 入口（第三方主题约定）被兼容并收敛到 #/admin', () => {
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#admin' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#admin?apiIndex=1' }), '/admin#/admin?apiIndex=1')
  // hash 与 search 同时存在时，search 补进 hash，不丢参数；hash 内已有 query 则不重复拼接
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?apiIndex=1', hash: '#admin' }), '/admin#/admin?apiIndex=1')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?apiIndex=1', hash: '#/admin?apiIndex=2' }), '/admin#/admin?apiIndex=2')
})

test('前缀相似的非后台 hash 不被误当成后台后缀（否则会拼出不存在的路由而白屏）', () => {
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/administrator' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#adminx' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/admin/' }), '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', search: '?apiIndex=1', hash: '#/administrator' }), '/admin#/admin?apiIndex=1')
})

test('已是标准形式时幂等，不再改写地址栏', () => {
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/admin' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/admin?apiIndex=1' }), null)
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin', hash: '#/admin?foo=1' }), null)
})

test('归一化结果一律解析为 /admin 路由，且不再残留裸 query', () => {
  const cases = [
    { pathname: '/admin' },
    { pathname: '/admin', search: '?foo=1' },
    { pathname: '/admin', search: '?apiIndex=1', hash: '#admin' },
    { pathname: '/admin', hash: '#admin' },
    { pathname: '/admin', hash: '#admin?apiIndex=1' },
    { pathname: '/admin', hash: '#/admin?apiIndex=1' }
  ]

  for (const loc of cases) {
    const target = resolveAdminEntryUrl(loc) ?? currentUrl(loc)
    const hashIndex = target.indexOf('#')
    assert.ok(hashIndex > -1, `后台入口必须带 hash: ${target}`)
    const queryIndex = target.indexOf('?')
    // 归一化后地址栏不再有裸 query：hash history 会把 pathname+search 吞进 base，
    // 留在 search 里的 ?foo=1 之后清不掉
    if (queryIndex > -1) assert.ok(queryIndex > hashIndex, `query 必须在 hash 内: ${target}`)
    assert.match(resolveHashLocation(target), /^\/admin(\?|$)/, target)
  }
})

test('详情页入口归一化后解析为 /server/:id 路由，且不再残留裸 query', () => {
  const cases = [
    { pathname: '/admin', hash: '#/server/1' },
    { pathname: '/admin', hash: '#/server/1?apiIndex=1' },
    { pathname: '/admin', search: '?apiIndex=1', hash: '#/server/2' }
  ]

  for (const loc of cases) {
    const target = resolveAdminEntryUrl(loc) ?? currentUrl(loc)
    const queryIndex = target.indexOf('?')
    if (queryIndex > -1) assert.ok(queryIndex > target.indexOf('#'), `query 必须在 hash 内: ${target}`)
    assert.match(resolveHashLocation(target), /^\/server\/\d+(\?|$)/, target)
  }
})

test('normalizeAdminEntryUrl 只在需要改写时 replaceState，且保留 null state', () => {
  const run = (loc) => {
    const calls = []
    globalThis.window = {
      location: { pathname: loc.pathname, search: loc.search || '', hash: loc.hash || '' },
      history: { replaceState: (state, _title, url) => calls.push({ state, url }) }
    }
    try {
      normalizeAdminEntryUrl()
    } finally {
      delete globalThis.window
    }
    return calls
  }

  assert.deepEqual(run({ pathname: '/admin', search: '?foo=1' }), [{ state: null, url: '/admin#/admin?foo=1' }])
  assert.deepEqual(run({ pathname: '/admin', hash: '#admin' }), [{ state: null, url: '/admin#/admin' }])
  assert.deepEqual(run({ pathname: '/admin', hash: '#/admin' }), [])
  assert.deepEqual(run({ pathname: '/admin', hash: '#/server/1' }), [])
  assert.deepEqual(run({ pathname: '/', hash: '#/' }), [])
})

test('非浏览器环境调用 normalizeAdminEntryUrl 不抛错', () => {
  assert.equal(ADMIN_ENTRY_URL, '/admin#/admin')
  assert.equal(resolveAdminEntryUrl({ pathname: '/admin' }), ADMIN_ENTRY_URL)
  assert.doesNotThrow(() => normalizeAdminEntryUrl())
})
