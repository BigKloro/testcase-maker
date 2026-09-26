import { useState } from "react";
import type { TestCase } from "../types";
import { Button, inputCls, labelCls, Modal } from "../ui";

const QUICK = ["Make it a boundary case on the maximum value", "Turn it into a negative case with invalid input", "Make the expected result more specific", "Split out a separate precondition"];

export function RegenerateModal({ tc, onSubmit, onClose }: { tc: TestCase; onSubmit: (instruction: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const submit = () => onSubmit(text.trim());
  return (
    <Modal
      title={`Regenerate ${tc.tc_id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="sparkle" onClick={submit}>
            Regenerate
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-md bg-subtle px-3 py-2 text-sm">{tc.title || <span className="text-muted">Untitled case</span>}</p>
      <label htmlFor="regen" className={labelCls}>
        Instruction for the model (optional)
      </label>
      <textarea
        id="regen"
        autoFocus
        className={inputCls}
        rows={3}
        maxLength={500}
        value={text}
        placeholder="Leave empty to make it sharper and more specific"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setText(q)} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-fg">
            {q}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">The rest of the group goes along as context so the new case doesn't duplicate its siblings.</p>
    </Modal>
  );
}
