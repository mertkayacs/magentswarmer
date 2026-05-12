// Dimmed single-line contextual hint below focused form fields.
// Inputs: text string. Outputs: Text with gray dimmed style.

import React from 'react'
import { Text } from 'ink'

interface FieldHintProps {
  text: string
}

export function FieldHint({ text }: FieldHintProps) {
  return (
    <Text color="gray" dimColor>
      {text}
    </Text>
  )
}
