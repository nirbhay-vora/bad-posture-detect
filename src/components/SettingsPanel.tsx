import type { Settings } from '../hooks/useSettings'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="space-y-5">
      {/* Posture Detection */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
        <p className="text-slate-300 font-semibold">🎯 Posture Detection</p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Deviation Threshold</span>
            <span className="text-white font-bold">{settings.deviationThreshold}%</span>
          </div>
          <input type="range" min={5} max={50} value={settings.deviationThreshold}
            onChange={e => onChange({ deviationThreshold: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <p className="text-slate-500 text-xs">How much slouch deviation triggers bad posture</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Alert After</span>
            <span className="text-white font-bold">{settings.slouchSeconds}s</span>
          </div>
          <input type="range" min={3} max={30} value={settings.slouchSeconds}
            onChange={e => onChange({ slouchSeconds: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <p className="text-slate-500 text-xs">Seconds of bad posture before alert fires</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Cooldown Between Alerts</span>
            <span className="text-white font-bold">{settings.cooldownSeconds}s</span>
          </div>
          <input type="range" min={5} max={60} value={settings.cooldownSeconds}
            onChange={e => onChange({ cooldownSeconds: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <p className="text-slate-500 text-xs">Minimum time between consecutive alerts</p>
        </div>
      </div>

      {/* Break Reminder */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-300 font-semibold">🚶 Break Reminder</p>
          <button
            onClick={() => onChange({ breakReminderEnabled: !settings.breakReminderEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.breakReminderEnabled ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.breakReminderEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className={`space-y-2 transition-opacity ${settings.breakReminderEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Remind After</span>
            <span className="text-white font-bold">{settings.breakReminderMinutes} min</span>
          </div>
          <input
            type="range" min={15} max={90} step={5}
            value={settings.breakReminderMinutes}
            onChange={e => onChange({ breakReminderMinutes: Number(e.target.value) })}
            className="w-full accent-amber-500"
            disabled={!settings.breakReminderEnabled}
          />
          <p className="text-slate-500 text-xs">Minutes of continuous sitting before break reminder fires</p>
        </div>
      </div>
    </div>
  )
}
