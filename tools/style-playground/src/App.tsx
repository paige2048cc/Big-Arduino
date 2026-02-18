import { useState } from 'react'
import { Palette } from 'lucide-react'
import HomepageLayout from './tabs/HomepageLayout'
import SecondaryPage from './tabs/SecondaryPage'
import CardStyles from './tabs/CardStyles'
import ButtonStyles from './tabs/ButtonStyles'

interface Tab {
  id: string
  label: string
  component: React.FC
}

const tabs: Tab[] = [
  { id: 'homepage', label: 'Homepage Layout', component: HomepageLayout },
  { id: 'secondary', label: 'Secondary Page', component: SecondaryPage },
  { id: 'cards', label: 'Card Styles', component: CardStyles },
  { id: 'buttons', label: 'Button Styles', component: ButtonStyles },
]

export default function App() {
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const ActiveComponent = tabs.find(t => t.id === activeTab)!.component

  return (
    <div className="playground">
      <header className="playground-header">
        <div className="playground-title">
          <Palette size={20} />
          <h1>Style Playground</h1>
        </div>
        <span className="playground-badge">Design exploration only</span>
      </header>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <ActiveComponent />
      </main>
    </div>
  )
}
