import { BeakerIcon, CheckIcon, ExclamationIcon } from '@heroicons/react/solid'
import { useState } from 'react'
import GetApiHandler, { PostApiHandler } from '../../../utils/ApiHandler'
import Button from '../Button'
import { SmallLoadingSpinner } from '../LoadingSpinner'

interface ITestButton<T> {
  // If payload is provided, we POST so tests can use the current form values (without saving)
  payload?: T
  testUrl: string
  onTestComplete?: (result: { status: boolean; message: string }) => void
}

interface TestStatus {
  clicked: boolean
  status: boolean
}

interface BasicResponse {
  status: 'OK' | 'NOK'
  code: 0 | 1
  message: string
}

const TestButton = <T,>(props: ITestButton<T>) => {
  const [loading, setLoading] = useState(false)

  // Tracks whether we clicked, and whether the last test succeeded
  const [clicked, setClicked] = useState<TestStatus>({
    clicked: false,
    status: false,
  })

  // Runs either GET or POST depending on whether payload exists
  const performTest = async () => {
    setLoading(true)

    try {
      const handler = props.payload
        ? PostApiHandler(props.testUrl, props.payload)
        : GetApiHandler(props.testUrl)

      const resp = (await handler) as BasicResponse

      const ok = resp.code === 1
      setClicked({ clicked: true, status: ok })

      props.onTestComplete?.({
        status: ok,
        message: resp.message,
      })
    } catch (e) {
      setClicked({ clicked: true, status: false })
      props.onTestComplete?.({
        status: false,
        message: 'Failure',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="ml-3 inline-flex rounded-md shadow-sm">
      <Button
        type="button"
        disabled={loading}
        buttonType={
          clicked.clicked ? (clicked.status ? 'success' : 'danger') : 'default'
        }
        onClick={performTest}
      >
        {loading ? (
          <SmallLoadingSpinner />
        ) : clicked.clicked ? (
          clicked.status ? (
            <CheckIcon />
          ) : (
            <ExclamationIcon />
          )
        ) : (
          <BeakerIcon />
        )}

        {/* Old label implied saving first. This is now a true live test. */}
        <span className="ml-1">Test</span>
      </Button>
    </span>
  )
}

export default TestButton
