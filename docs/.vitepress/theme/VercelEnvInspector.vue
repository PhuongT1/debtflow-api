<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';

const token = ref('');
const project = ref('prj_Bk3FhBLarkFcSC3Wq2yDqafLkbEH');
const team = ref('team_X20Zb3IepRSudAgwGR7HdP49');
const target = ref('preview');
const branch = ref('develop');
const busy = ref(false);
const error = ref('');
const result = ref(null);
const rows = ref([]);
const showOther = ref(false);
const otherCount = computed(
  () => rows.value.filter((row) => row.source === 'Bổ sung khi pull').length,
);
const visibleRows = computed(() =>
  showOther.value ? rows.value : rows.value.filter((row) => row.source !== 'Bổ sung khi pull'),
);
const revealed = ref(new Set());
let controller;
const defaultsController = new AbortController();
onMounted(async () => {
  try {
    const response = await fetch('/__vercel-env-inspector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'defaults' }),
      cache: 'no-store',
      signal: defaultsController.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const defaults = await response.json();
    if (!token.value && typeof defaults.token === 'string') token.value = defaults.token;
  } catch {
    /* Published docs do not have local defaults. */
  }
});
function clear() {
  defaultsController.abort();
  controller?.abort();
  token.value = '';
  result.value = null;
  rows.value = [];
  revealed.value = new Set();
  error.value = '';
}
onBeforeUnmount(clear);
function state(value) {
  if (value === undefined || value === null) return 'Không có value';
  if (value === '') return 'Chuỗi rỗng';
  if (['[SENSITIVE]', '[REDACTED]'].includes(value)) return 'Bị che / placeholder';
  return 'Có giá trị trả về';
}
async function run(action, row) {
  busy.value = true;
  error.value = '';
  revealed.value = new Set();
  if (action !== 'read') {
    showOther.value = false;
    rows.value = [];
    result.value = null;
  }
  controller = new AbortController();
  try {
    const response = await fetch('/__vercel-env-inspector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.value,
        project: project.value.trim(),
        team: team.value.trim(),
        target: target.value,
        branch: branch.value.trim(),
        action,
        id: row?.id,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error(
        'Công cụ chỉ hoạt động qua npm run docs:dev trên localhost; không có proxy trên docs đã publish.',
      );
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || `HTTP ${response.status}`);
    result.value = { status: payload.status, endpoint: payload.endpoint, action };
    if (action === 'read') {
      row.value = payload.data.value;
      row.decrypted = payload.data.decrypted;
    } else if (action === 'list') {
      rows.value = (Array.isArray(payload.data.envs) ? payload.data.envs : []).map((env) => ({
        ...env,
        source: 'Project API',
      }));
    } else {
      const env = payload.data.env ?? {};
      const buildEnv = payload.data.buildEnv ?? {};
      const configured = new Set(payload.data.configuredKeys);
      const keys = new Set([...configured, ...Object.keys(env), ...Object.keys(buildEnv)]);
      rows.value = [...keys].map((key) => ({
        key,
        source: configured.has(key) ? 'Cấu hình project' : 'Bổ sung khi pull',
        value: Object.hasOwn(env, key) ? env[key] : buildEnv[key],
      }));
    }
  } catch (cause) {
    if (cause.name !== 'AbortError') error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
function toggle(index) {
  const next = new Set(revealed.value);
  next.has(index) ? next.delete(index) : next.add(index);
  revealed.value = next;
}
</script>

<template>
  <section class="env-inspector" aria-label="Vercel env inspector">
    <div class="notice">
      Token mặc định được nạp từ file local Git bỏ qua; token và kết quả trên giao diện chỉ giữ
      trong bộ nhớ trang. Request đi qua docs server local tới api.vercel.com.
    </div>
    <form @submit.prevent="run('list')" autocomplete="off">
      <label
        >Vercel Access Token<input
          v-model="token"
          type="password"
          autocomplete="off"
          placeholder="Nhập token có quyền đọc project"
          required
          :disabled="busy"
      /></label>
      <div class="fields">
        <label>Project ID hoặc tên<input v-model="project" required :disabled="busy" /></label>
        <label
          >Team ID hoặc slug<input
            v-model="team"
            placeholder="team_… hoặc tran-phuongs-projects"
            :disabled="busy"
        /></label>
        <label
          >Environment<select v-model="target" :disabled="busy">
            <option>preview</option>
            <option>production</option>
            <option>development</option>
          </select></label
        >
        <label
          >Preview branch<input
            v-model="branch"
            :disabled="busy || target !== 'preview'"
            placeholder="Để trống để thử Preview chung"
        /></label>
      </div>
      <div class="actions">
        <button type="submit" :disabled="busy || !token">1. Liệt kê biến</button>
        <button type="button" :disabled="busy || !token || !project" @click="run('pull')">
          2. Thử env pull
        </button>
        <button type="button" @click="clear">Xóa token và kết quả</button>
      </div>
    </form>
    <p v-if="busy" role="status">Đang gọi Vercel…</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="result">
      <strong>HTTP {{ result.status }}</strong> · <code>GET {{ result.endpoint }}</code> ·
      {{ visibleRows.length }} biến
    </p>
    <label v-if="otherCount" class="other-toggle">
      <input v-model="showOther" type="checkbox" @change="revealed = new Set()" />
      Hiện {{ otherCount }} biến bổ sung từ API pull
    </label>
    <div v-if="result" class="results">
      <table>
        <thead>
          <tr>
            <th>Biến / nguồn</th>
            <th>Loại / phạm vi</th>
            <th>Value API trả về</th>
            <th>Thử đọc</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in visibleRows"
            :key="`${row.source}-${row.id || row.key}-${index}`"
          >
            <td>
              <strong>{{ row.key }}</strong
              ><small>{{ row.source }}</small>
            </td>
            <td>
              {{ row.visibility || row.type || '—'
              }}<small
                >{{ Array.isArray(row.target) ? row.target.join(', ') : row.target }}
                {{ row.gitBranch || '' }}</small
              ><small v-if="row.decrypted !== undefined">decrypted: {{ row.decrypted }}</small>
            </td>
            <td>
              <span>{{ state(row.value) }}</span>
              <div v-if="row.value !== undefined && row.value !== null">
                <button type="button" @click="toggle(index)">
                  {{ revealed.has(index) ? 'Ẩn value' : 'Xem value' }}
                </button>
                <pre v-if="revealed.has(index)">{{
                  typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2)
                }}</pre>
              </div>
            </td>
            <td>
              <button
                v-if="row.id"
                type="button"
                :disabled="busy || !token"
                @click="run('read', row)"
              >
                Đọc qua API</button
              ><span v-else>—</span>
            </td>
          </tr>
          <tr v-if="!visibleRows.length">
            <td colspan="4">API không trả dòng env nào.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.env-inspector {
  border: 1px solid var(--vp-c-divider);
  padding: 20px;
  border-radius: 12px;
  margin: 24px 0;
}
.notice {
  background: var(--vp-c-bg-soft);
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
}
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
input,
select {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 9px 12px;
  width: 100%;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.other-toggle {
  flex-direction: row;
  align-items: center;
}
.other-toggle input {
  width: auto;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
button {
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.results {
  overflow-x: auto;
}
table {
  width: 100%;
  font-size: 13px;
}
small {
  display: block;
  color: var(--vp-c-text-2);
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 360px;
  max-height: 200px;
  overflow: auto;
}
.error {
  color: var(--vp-c-danger-1);
}
@media (max-width: 640px) {
  .fields {
    grid-template-columns: 1fr;
  }
  .env-inspector {
    padding: 12px;
  }
}
</style>
