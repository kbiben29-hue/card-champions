import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './ui/styles.css'

/** Shows what went wrong instead of a blank page. */
class Catch extends Component<{ children: ReactNode }, { err: Error | null }> {
	state = { err: null as Error | null }
	static getDerivedStateFromError(err: Error) {
		return { err }
	}
	render() {
		const { err } = this.state
		if (!err) return this.props.children
		return (
			<div className="screen home">
				<div className="panel">
					<h3>Something went wrong</h3>
					<p>{err.message}</p>
					<pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{(err.stack ?? '').split('\n').slice(0, 6).join('\n')}</pre>
					<button
						className="primary"
						onClick={() => {
							try {
								localStorage.removeItem('champions.save.v1')
							} catch {}
							location.reload()
						}}
					>
						Back to the home screen (drops the saved game)
					</button>
				</div>
			</div>
		)
	}
}

// no long-press menus or text selection on the table (inputs stay selectable)
document.addEventListener('contextmenu', (e) => {
	const t = e.target as HTMLElement
	if (!t.closest('input,textarea,.selectable')) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Catch>
			<App />
		</Catch>
	</StrictMode>,
)
