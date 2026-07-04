import {lazy, Suspense} from 'react'
import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {Route, Routes} from 'react-router'
import {LoadingOrError} from '@/components/LoadingOrError'
import { FullGrid } from './pages/FullGrid'
import { Manager } from './pages/Manager'
import { CallUp } from './pages/CallUp'
import { HeaderWithWaveTime } from './components/HeaderWithWaveTime'
// import { EpunchCheck } from './pages/EpunchCheck'



function renderError({error}: FallbackProps) {
	return <LoadingOrError error={error} />
}

export function App() {
	return (
		<div className='flex flex-col max-h-screen'>
		<ErrorBoundary fallbackRender={renderError}>
			<Suspense fallback={<LoadingOrError />}>
				<Routes>
					<Route element={<HeaderWithWaveTime />}>
						<Route index element={<FullGrid />} />
						<Route element={<CallUp />} 
							index={true} 
							path='/call-up' />
						<Route element={<Manager />} 
							index={true} 
							path='/manager' />
					</Route>
					
					{/* <Route element={<WaveTimeWrapper content='grid' />} index={true} path='/' />
					<Route element={<WaveTimeWrapper content='manager' />} index={true} path='/manager' />

					<Route element={<WaveTimeWrapper content='callup' userSelectedWaves={true} />} index={true} path='/call-up' /> */}
				</Routes>
			</Suspense>
		</ErrorBoundary>
		</div>
	)
}
