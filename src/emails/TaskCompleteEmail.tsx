import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface TaskCompleteEmailProps {
  userName: string;
  taskName: string;
  result: string;
  timeElapsed: string;
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function TaskCompleteEmail({ userName, taskName, result, timeElapsed }: TaskCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Task complete: ${taskName}`}</Preview>
      <Body
        style={{
          backgroundColor: "#f5f5f5",
          color: "#111111",
          fontFamily: FONT_STACK,
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #d4d4d4",
            borderRadius: "24px",
            margin: "0 auto",
            maxWidth: "640px",
            overflow: "hidden",
          }}
        >
          <Section style={{ padding: "32px" }}>
            <Text
              style={{
                color: "#737373",
                fontSize: "12px",
                letterSpacing: "0.12em",
                margin: "0 0 12px",
                textTransform: "uppercase",
              }}
            >
              ✓ Task Complete
            </Text>
            <Heading
              style={{
                color: "#111111",
                fontSize: "32px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: "1.15",
                margin: "0 0 12px",
              }}
            >
              {taskName}
            </Heading>
            <Text style={{ color: "#404040", fontSize: "15px", lineHeight: "1.7", margin: "0 0 18px" }}>
              {`Hi ${userName}, your task has finished running in Inceptive.`}
            </Text>
            <Section
              style={{
                backgroundColor: "#fafafa",
                border: "1px solid #e5e5e5",
                borderRadius: "18px",
                padding: "20px",
                marginBottom: "22px",
              }}
            >
              <Text style={{ color: "#737373", fontSize: "11px", letterSpacing: "0.08em", margin: "0 0 10px", textTransform: "uppercase" }}>
                Result Summary
              </Text>
              <Text style={{ color: "#262626", fontSize: "15px", lineHeight: "1.7", margin: 0 }}>{result}</Text>
            </Section>
            <Button
              href="https://app.inceptive-ai.com"
              style={{
                backgroundColor: "#111111",
                borderRadius: "999px",
                color: "#ffffff",
                display: "inline-block",
                fontSize: "15px",
                fontWeight: 700,
                padding: "14px 24px",
                textDecoration: "none",
              }}
            >
              View in Inceptive
            </Button>
            <Text style={{ color: "#737373", fontSize: "12px", lineHeight: "1.6", margin: "24px 0 0" }}>
              {`Completed in ${timeElapsed}`}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TaskCompleteEmail;
