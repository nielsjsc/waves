import {lazy, Suspense} from 'react'
import {ErrorBoundary, type FallbackProps} from 'react-error-boundary'
import {Route, Routes} from 'react-router'
import {LoadingOrError} from '@/components/LoadingOrError'
import { FullGrid } from './pages/FullGrid'
import { Manager } from './pages/Manager'
import { CallUp } from './pages/CallUp'
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
					<Route element={<FullGrid />} index={true} path='/' />
					<Route element={<Manager />} index={true} path='/manager' />
					<Route element={<CallUp />} index={true} path='/call-up' />
					{/* <Route element={<EpunchCheck />} index={true} path='/epunch-check' /> */}
				</Routes>
			</Suspense>
		</ErrorBoundary>
		</div>
	)
}
