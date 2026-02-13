import { AxiosError } from 'axios'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useStopAllRuleExecution } from '../api/rules'
import AddButton from '../components/Common/AddButton'
import Alert from '../components/Common/Alert'
import ExecuteButton from '../components/Common/ExecuteButton'
import LibrarySwitcher from '../components/Common/LibrarySwitcher'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import RuleGroup, { IRuleGroup } from '../components/Rules/RuleGroup'
import { useTaskStatusContext } from '../contexts/taskstatus-context'
import GetApiHandler, { PostApiHandler } from '../utils/ApiHandler'

const RulesListPage = () => {
  const navigate = useNavigate()
  const [selectedLibrary, setSelectedLibrary] = useState<string>('all')
  const { ruleHandlerRunning } = useTaskStatusContext()
  const {
    data: allRulesData,
    isLoading,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ['rules', 'list'],
    queryFn: async () => await GetApiHandler<IRuleGroup[]>('/rules'),
    staleTime: 0,
  })
  const { mutate: stopAllExecution } = useStopAllRuleExecution({
    onSuccess() {
      toast.success('Requested to stop all rule executions.')
    },
    onError() {
      toast.error('Failed to request stop of all rule executions.')
    },
  })

  const countRulesMissingLibraries = (ruleGroups: IRuleGroup[]) => {
    return ruleGroups.filter((ruleGroup) => !ruleGroup.libraryId).length
  }

  const allRules = allRulesData ?? []

  const availableLibraryIds = Array.from(
    new Set(
      allRules
        .map((ruleGroup) => ruleGroup.libraryId)
        .filter((libraryId): libraryId is string => Boolean(libraryId)),
    ),
  )

  const rulesMissingLibraryCount = countRulesMissingLibraries(allRules)
  const activeRulesCount = allRules.filter((rule) => rule.isActive).length
  const effectiveSelectedLibrary =
    selectedLibrary === 'all' || availableLibraryIds.includes(selectedLibrary)
      ? selectedLibrary
      : 'all'

  const data =
    effectiveSelectedLibrary === 'all'
      ? allRules
      : allRules.filter(
          (ruleGroup) => ruleGroup.libraryId === effectiveSelectedLibrary,
        )

  const onSwitchLibrary = (libraryId: string) => {
    setSelectedLibrary(libraryId)
  }

  const editHandler = (group: IRuleGroup): void => {
    navigate(`/rules/edit/${group.id}`)
  }

  const sync = async () => {
    try {
      await PostApiHandler(`/rules/execute`, {})
    } catch (e) {
      if (e instanceof AxiosError) {
        if (e.response?.status === 409) {
          toast.error('Rule execution is already running.')
          return
        }
      }

      toast.error('Failed to initiate rule execution.')
    }
  }

  const onDeleteRuleGroup = () => {
    void refetchRules()
  }

  if (isLoading || !allRulesData) {
    return (
      <>
        <title>Rules - Maintainerr</title>
        <span>
          <LoadingSpinner />
        </span>
      </>
    )
  }

  return (
    <>
      <title>Rules - Maintainerr</title>
      <div className="w-full">
        <LibrarySwitcher
          onLibraryChange={onSwitchLibrary}
          allowedLibraryIds={availableLibraryIds}
          selectedLibraryId={effectiveSelectedLibrary}
        />
        {effectiveSelectedLibrary === 'all' && rulesMissingLibraryCount > 0 && (
          <Alert
            type="warning"
            title={`${rulesMissingLibraryCount} ${rulesMissingLibraryCount === 1 ? 'rule does' : 'rules do'} not have a library attached`}
          >
            Edit these rules and select a library before running.
          </Alert>
        )}

        <div className="m-auto mb-3 flex">
          <div className="ml-auto sm:ml-0">
            <AddButton onClick={() => navigate('/rules/new')} text="New Rule" />
          </div>
          <div className="ml-2 mr-auto sm:mr-0">
            <ExecuteButton
              onClick={() => {
                if (ruleHandlerRunning) {
                  stopAllExecution()
                } else {
                  if (rulesMissingLibraryCount > 0) {
                    toast.warn(
                      `${rulesMissingLibraryCount} ${rulesMissingLibraryCount === 1 ? 'rule is' : 'rules are'} missing a library.`,
                    )

                    if (activeRulesCount === 0) {
                      return
                    }
                  }

                  if (activeRulesCount === 0) {
                    toast.warn('No active rules to run.')
                    return
                  }
                  sync()
                }
              }}
              text={ruleHandlerRunning ? 'Stop Rules' : 'Run Rules'}
              executing={ruleHandlerRunning}
            />
          </div>
        </div>
        <h1 className="mb-3 text-lg font-bold text-zinc-200">{'Rules'}</h1>
        <ul className="xs:grid xs:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] xs:gap-4">
          {data.map((el) => (
            <li
              key={el.id}
              className="collection relative mb-5 flex h-fit transform-gpu flex-col rounded-xl bg-zinc-800 bg-cover bg-center p-4 text-zinc-400 shadow ring-1 ring-zinc-700 xs:w-full sm:mb-0 sm:mr-5"
            >
              <RuleGroup
                onDelete={onDeleteRuleGroup}
                onEdit={editHandler}
                group={el}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

export default RulesListPage
