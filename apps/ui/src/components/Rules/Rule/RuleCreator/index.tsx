import {
  ClipboardDocumentListIcon,
  DocumentPlusIcon,
} from '@heroicons/react/20/solid'
import { type MediaItemType, MediaType } from '@maintainerr/contracts'
import { useCallback, useRef, useState } from 'react'
import Alert from '../../../Common/Alert'
import SectionHeading from '../../../Common/SectionHeading'
import RuleInput from './RuleInput'

interface IRulesToCreate {
  id: number
  rule: IRule
}

export interface IRule {
  operator: string | null
  firstVal: [string, string]
  lastVal?: [string, string]
  section?: number
  customVal?: { ruleTypeId: number; value: string | number }
  action: number
}

export interface ILoadedRule {
  uniqueID: number
  rules: IRule[]
}

interface iRuleCreator {
  mediaType?: MediaType
  dataType?: MediaItemType
  editData?: { rules: IRule[] }
  onUpdate: (rules: IRule[]) => void
  onCancel: () => void
  radarrSettingsId?: number | null
  sonarrSettingsId?: number | null
}

const calculateRuleAmount = (
  data: { rules: IRule[] } | undefined,
  sections: number,
): [number, number[]] => {
  const sectionAmounts = [] as number[]
  if (data) {
    data.rules.forEach((el) => {
      const section = el.section ?? 0
      sectionAmounts[section] = (sectionAmounts[section] ?? 0) + 1
    })
  }

  return [
    sections,
    sectionAmounts.filter((el) => el !== undefined && el !== null),
  ]
}

const calculateSectionCount = (data: { rules: IRule[] } | undefined) => {
  if (!data || !Array.isArray(data.rules) || data.rules.length <= 0) {
    return undefined
  }

  return Math.max(...data.rules.map((rule) => rule.section ?? 0)) + 1
}

const calculateRuleAmountArr = (ruleAmount: [number, number[]]) => {
  let s = 0,
    r = 0
  const lenS = ruleAmount[0]

  const worker: [number[], [number[]]] = [[], [[]]]

  while (++s <= lenS) {
    worker[0].push(s)
    if (s > 1) {
      worker[1].push([])
    }
  }

  for (const sec of worker[0]) {
    r = 0
    while (++r <= ruleAmount[1][sec - 1]) worker[1][sec - 1].push(r)
  }

  return worker
}

const calculateRuleId = (
  ruleAmount: [number, number[]],
  sectionId: number,
  ruleId: number,
) =>
  ruleAmount[1].length > 1
    ? ruleAmount[1].reduce((pv, cv, idx) =>
        sectionId === 1
          ? cv - (cv - ruleId)
          : idx <= sectionId - 1
            ? idx === sectionId - 1
              ? cv - (cv - ruleId) + pv
              : cv + pv
            : pv,
      )
    : ruleAmount[1][0] - (ruleAmount[1][0] - ruleId)

const RuleCreator = (props: iRuleCreator) => {
  const { onUpdate } = props
  const initialSections = calculateSectionCount(props.editData)
  const initialRuleAmount: [number, number[]] = initialSections
    ? calculateRuleAmount(props.editData, initialSections)
    : [1, [1]]
  const initialRulesCreated: IRulesToCreate[] =
    props.editData?.rules.map((rule, index) => ({
      id: index + 1,
      rule,
    })) ?? []

  const [ruleAmount, setRuleAmount] =
    useState<[number, number[]]>(initialRuleAmount)
  const [ruleAmountArr, setRuleAmountArr] = useState<[number[], [number[]]]>(
    calculateRuleAmountArr(initialRuleAmount),
  )
  const rulesCreated = useRef<IRulesToCreate[]>(initialRulesCreated)
  const [renderRules, setRenderRules] =
    useState<IRulesToCreate[]>(initialRulesCreated)
  const [deletedVersion, setDeletedVersion] = useState(0)
  const [addedRules, setAddedRules] = useState<number[]>(
    initialSections ? [] : [1],
  )
  const [committedRuleCount, setCommittedRuleCount] = useState(
    initialRulesCreated.length,
  )

  const updateRuleAmount = useCallback((ruleAmount: [number, number[]]) => {
    setRuleAmountArr(calculateRuleAmountArr(ruleAmount))
    setRuleAmount(ruleAmount)
  }, [])

  const ruleCommited = useCallback(
    (id: number, rule: IRule) => {
      if (rulesCreated) {
        const rules = rulesCreated.current.filter((el) => el.id !== id)
        const toCommit = [...rules, { id: id, rule: rule }].sort(
          (a, b) => a.id - b.id,
        )
        rulesCreated.current = toCommit
        setRenderRules(toCommit)
        setCommittedRuleCount(rulesCreated.current.length)
        onUpdate(rulesCreated.current.map((el) => el.rule))
        setAddedRules((currentAddedRules) =>
          currentAddedRules.filter((e) => e !== id),
        )
      }
    },
    [onUpdate],
  )

  const ruleOmitted = useCallback(
    (id: number) => {
      if (rulesCreated) {
        const rules = rulesCreated.current?.filter((el) => el.id !== id)
        rulesCreated.current = [...rules]
        setRenderRules(rulesCreated.current)
        setCommittedRuleCount(rulesCreated.current.length)
        onUpdate(rulesCreated.current.map((el) => el.rule))
      }
    },
    [onUpdate],
  )

  const ruleDeleted = useCallback(
    (section = 0, id: number) => {
      if (rulesCreated.current.length > 0) {
        let rules = rulesCreated.current?.filter((el) => el.id !== id)
        const section1IsEmpty = !rules.some((r) => r.rule.section === 0)

        rules = rules.map((e) => {
          e.id = e.id > id ? e.id - 1 : e.id

          if (section1IsEmpty && section === 1 && e.rule.section) {
            e.rule.section -= 1
          }

          return e
        })
        rulesCreated.current = [...rules]
        setRenderRules(rulesCreated.current)
        setCommittedRuleCount(rulesCreated.current.length)
        onUpdate(rulesCreated.current.map((el) => el.rule))
      }

      setAddedRules((currentAddedRules) =>
        currentAddedRules
          .filter((e) => e !== id)
          .map((e) => {
            return (e = e > id ? e - 1 : e)
          }),
      )
      const rules = [...ruleAmount[1]]
      rules[section - 1] = rules[section - 1] - 1

      // Find sections that still contain rules
      const nonEmptySections = rules.filter((e) => e > 0)

      // Update the rule count while ensuring at least one section remains
      updateRuleAmount([
        nonEmptySections.length,
        nonEmptySections.length > 0 ? nonEmptySections : [1],
      ])

      setDeletedVersion((currentVersion) => currentVersion + 1)
    },
    [onUpdate, ruleAmount, updateRuleAmount],
  )

  const RuleAdded = (section: number) => {
    const ruleId =
      ruleAmount[1].reduce((prev, cur, idx) =>
        idx + 1 <= section ? prev + cur : prev,
      ) + 1

    setAddedRules((currentAddedRules) => [...currentAddedRules, ruleId])

    rulesCreated.current.map((e) => {
      if (e.id >= ruleId) {
        e.id = e.id + 1
      }
      return e
    })
    setRenderRules([...rulesCreated.current])

    const rules = [...ruleAmount[1]]
    rules[section - 1] = rules[section - 1] + 1

    updateRuleAmount([ruleAmount[0], rules])
  }

  const addSection = () => {
    const rules = [...ruleAmount[1]]
    rules.push(1)

    const ruleId =
      ruleAmount[1].reduce((prev, cur, idx) =>
        idx + 1 <= ruleAmount[0] + 1 ? prev + cur : prev,
      ) + 1
    setAddedRules((currentAddedRules) => [...currentAddedRules, ruleId])

    updateRuleAmount([ruleAmount[0] + 1, rules])
  }

  return (
    <div className="text-zinc-100">
      {ruleAmountArr[0].map((sid) => {
        return (
          <div key={`${sid}-${deletedVersion}`} className="mb-4">
            <div className="rounded-lg bg-zinc-700 px-6 py-0.5 shadow-md">
              <SectionHeading id={sid} name={'Section'} />
              <div className="flex flex-col space-y-2">
                {ruleAmountArr[1][sid - 1].map((id) => {
                  const currentRuleId = calculateRuleId(ruleAmount, sid, id)
                  const currentRule = renderRules.find(
                    (rule) => rule.id === currentRuleId,
                  )?.rule

                  return (
                    <div
                      key={`${sid}-${id}`}
                      className="flex w-full flex-col items-start"
                    >
                      <div className="mb-4 w-full">
                        <RuleInput
                          key={`${sid}-${id}`}
                          id={currentRuleId}
                          tagId={id}
                          editData={
                            currentRule ? { rule: currentRule } : undefined
                          }
                          section={sid}
                          newlyAdded={addedRules}
                          mediaType={props.mediaType}
                          dataType={props.dataType}
                          radarrSettingsId={props.radarrSettingsId}
                          sonarrSettingsId={props.sonarrSettingsId}
                          onCommit={ruleCommited}
                          onIncomplete={ruleOmitted}
                          onDelete={ruleDeleted}
                          allowDelete={
                            ruleAmount[0] > 1 || ruleAmount[1][sid - 1] > 1
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {addedRules.length <= 0 ? (
                <div className="mb-2 flex w-full justify-end">
                  <button
                    type="button"
                    className="flex h-8 rounded bg-maintainerr-600 text-zinc-200 shadow-md hover:bg-maintainerr"
                    onClick={() => RuleAdded(sid)}
                    title={`Add a new rule to Section ${sid}`}
                  >
                    <DocumentPlusIcon className="m-auto ml-5 h-5" />
                    <p className="button-text m-auto ml-1 mr-5 text-zinc-200">
                      Add Rule
                    </p>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      {addedRules.length <= 0 ? (
        <div className="mb-3 mt-3 flex w-full">
          <div className="m-auto xl:m-0">
            <button
              type="button"
              className="flex h-8 rounded bg-maintainerr-600 text-zinc-200 shadow-md hover:bg-maintainerr"
              onClick={addSection}
              title={`Add a new section`}
            >
              <ClipboardDocumentListIcon className="m-auto ml-5 h-5" />
              <p className="button-text m-auto ml-1 mr-5 text-zinc-200">
                New Section
              </p>
            </button>
          </div>
        </div>
      ) : undefined}

      {committedRuleCount !== ruleAmount[1].reduce((pv, cv) => pv + cv) ? (
        <div className="max-width-form-head mt-5">
          <Alert>{`Some incomplete rules won't be saved`} </Alert>
        </div>
      ) : undefined}
    </div>
  )
}

export default RuleCreator
