import {lazy, Suspense} from 'react'
import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
// import {Route, Routes} from 'react-router'
import {LoadingOrError} from '@/components/LoadingOrError'
import { HeaderWithWaveTime } from './components/HeaderWithWaveTime'



function renderError({error}: FallbackProps) {
	return <LoadingOrError error={error} />
}

export function App() {
	return (
		<div className='flex flex-col max-h-screen'>
		<ErrorBoundary fallbackRender={renderError}>
			<Suspense fallback={<LoadingOrError />}>
				<HeaderWithWaveTime />
			</Suspense>
		</ErrorBoundary>
		</div>
	)
}
