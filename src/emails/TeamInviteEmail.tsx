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

export interface TeamInviteEmailProps {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function TeamInviteEmail({ inviterName, orgName, inviteUrl }: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${inviterName} invited you to join ${orgName} on Inceptive.`}</Preview>
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
          <Section style={{ padding: "28px 32px 18px", borderBottom: "1px solid #e5e5e5" }}>
            <Text
              style={{
                color: "#111111",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              INCEPTIVE
            </Text>
          </Section>

          <Section style={{ padding: "32px" }}>
            <Text
              style={{
                color: "#737373",
                fontSize: "12px",
                letterSpacing: "0.12em",
                margin: "0 0 10px",
                textTransform: "uppercase",
              }}
            >
              Team invitation
            </Text>
            <Heading
              style={{
                color: "#111111",
                fontSize: "32px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: "1.15",
                margin: "0 0 16px",
              }}
            >
              {`You've been invited to join ${orgName} on Inceptive`}
            </Heading>
            <Text style={{ color: "#404040", fontSize: "15px", lineHeight: "1.7", margin: "0 0 14px" }}>
              {`${inviterName} invited you to collaborate in Inceptive.`}
            </Text>
            <Text style={{ color: "#404040", fontSize: "15px", lineHeight: "1.7", margin: "0 0 28px" }}>
              Inceptive helps teams delegate research, execution, outreach, and reporting to AI with a shared system your org can actually operate.
            </Text>
            <Button
              href={inviteUrl}
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
              Accept Invitation
            </Button>
            <Text style={{ color: "#737373", fontSize: "12px", lineHeight: "1.6", margin: "24px 0 0" }}>
              This invitation expires in 7 days.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TeamInviteEmail;
