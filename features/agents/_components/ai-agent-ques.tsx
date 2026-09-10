"use client"

import { useState, type SubmitEvent } from "react"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { ClarificationQuestion, ClarificationQuestionType } from "../types"

interface AiAgentQuesPropType {
  questionList: ClarificationQuestion[]
  // Called with the resolved id → answer map once every question is answered and Submit is pressed.
  onComplete: (answers: Record<string, string | string[]>) => void
}

// Maps our question types onto the native <input> types the Questionnaire
// primitive's Input supports for non-choice questions.
const INPUT_TYPE_BY_QUESTION_TYPE: Partial<Record<ClarificationQuestionType, "text" | "number" | "date" | "time">> = {
  text: "text",
  number: "number",
  date: "date",
  time: "time",
}

/**
 * @component AiAgentQues
 * @description Multi-step clarification questionnaire the AI asks before it can finish generating an agent config — one step per question, with a progress header and Previous/Next/Submit navigation. Built on the Questionnaire primitive, which owns stepping, per-question validation, and native radio/checkbox semantics as a real <form>.
 * @param questionList Ordered clarification questions from the agent-config API response.
 * @param onComplete Called once every question is answered and the last step is submitted.
 */
export const AiAgentQues = ({ questionList, onComplete }: AiAgentQuesPropType) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const total = questionList.length
  const percent = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0

  // Keeps the progress header in sync with whichever step the Questionnaire is on.
  const handleItemChange = (item: string) => {
    const index = questionList.findIndex((question) => question.id === item)
    if (index !== -1) setCurrentIndex(index)
  }

  // The Questionnaire primitive names each choice/input's native input after
  // its question id, so on final submit we read everything straight off the
  // form. A question's "type your own answer" field is a plain, unregistered
  // input named "<id>__custom" (kept outside the primitive's own validation)
  // and wins over a picked choice whenever it's filled in.
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const answers: Record<string, string | string[]> = {}
    let missing = false

    for (const question of questionList) {
      const custom = String(formData.get(`${question.id}__custom`) ?? "").trim()

      if (custom) {
        answers[question.id] = custom
        continue
      }

      if (question.type === "multi_select") {
        const values = formData.getAll(question.id).map(String)
        if (values.length === 0) missing = true
        answers[question.id] = values
        continue
      }

      const value = String(formData.get(question.id) ?? "").trim()
      if (!value) missing = true
      answers[question.id] = value
    }

    if (missing) {
      setSubmitError("Please answer every question before continuing.")
      return
    }

    setSubmitError(null)
    onComplete(answers)
  }

  if (total === 0) return null

  return (
    <Questionnaire
      defaultItem={questionList[0].id}
      items={questionList.map((question) => ({
        name: question.id,
        required: true,
        choices:
          question.type === "single_select" || question.type === "multi_select"
            ? question.options.map((option) => ({ value: option }))
            : undefined,
      }))}
      onItemChange={handleItemChange}
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-card p-6 text-card-foreground sm:p-8"
    >
      <Progress value={percent} max={100}>
        <div className="flex items-center justify-between text-sm w-full">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {total}
          </span>
          <span className="font-medium text-foreground">{percent}%</span>
        </div>
      </Progress>

      {questionList.map((question) => {
        // Only single/multi-select questions have a choice list — for those,
        // "allowCustom" adds a fallback text field alongside the options. A
        // text/number/date/time question is already a single freeform input,
        // so it never gets a second one.
        const isChoiceQuestion = question.type === "single_select" || question.type === "multi_select"

        return (
          <QuestionnaireItem key={question.id} name={question.id} multiple={question.type === "multi_select"}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Help me understand your request
            </p>
            <QuestionnaireTitle className="text-xl">{question.question}</QuestionnaireTitle>

            {isChoiceQuestion ? (
              <QuestionnaireChoices>
                {question.options.map((option) => (
                  <QuestionnaireChoice key={option} value={option}>
                    {option}
                  </QuestionnaireChoice>
                ))}
              </QuestionnaireChoices>
            ) : (
              <QuestionnaireInput
                type={INPUT_TYPE_BY_QUESTION_TYPE[question.type] ?? "text"}
                placeholder={question.customPlaceholder || "Type your answer…"}
                required
              />
            )}

            {isChoiceQuestion && question.allowCustom && (
              <Input
                name={`${question.id}__custom`}
                placeholder={question.customPlaceholder || "Or type your own answer…"}
              />
            )}
          </QuestionnaireItem>
        )
      })}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <QuestionnaireActions className="border-t pt-6">
        <QuestionnairePrevious />
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  )
}
