import { PlusCircleIcon } from '@heroicons/react/solid'

interface IAddButton {
  text: string
  onClick: () => void
}

const AddButton = (props: IAddButton) => {
  return (
    <button
      className="add-button m-auto flex h-9 rounded bg-sky-600 text-slate-100 shadow-lg shadow-sky-950/30 hover:bg-sky-500"
      onClick={props.onClick}
    >
      {<PlusCircleIcon className="m-auto ml-4 h-5" />}
      <p className="rules-button-text m-auto ml-1 mr-4">{props.text}</p>
    </button>
  )
}

export default AddButton
