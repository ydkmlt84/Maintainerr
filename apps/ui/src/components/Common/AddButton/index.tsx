import { PlusCircleIcon } from '@heroicons/react/solid'

interface IAddButton {
  text: string
  onClick: () => void
}

const AddButton = (props: IAddButton) => {
  return (
    <button
      className="m-auto flex h-9 rounded bg-maintainerr-600 text-white shadow-lg shadow-maintainerr-950/30 transition hover:bg-maintainerr"
      onClick={props.onClick}
    >
      {<PlusCircleIcon className="m-auto ml-4 h-5" />}
      <p className="rules-button-text m-auto ml-1 mr-4">{props.text}</p>
    </button>
  )
}

export default AddButton
