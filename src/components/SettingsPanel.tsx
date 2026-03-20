import type { Settings } from '../hooks/useSettings'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-5">
      <p className="text-slate-300 font-semibold">⚙️ Settings</p>

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
  )
}
