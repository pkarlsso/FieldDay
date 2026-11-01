# SES email delivery

The backend can use Amazon SES for signup verification and password reset emails. Set `EMAIL_PROVIDER=ses`, `AWS_REGION`, and `SES_FROM` in the backend environment. The sender must be verified in SES in that region. Grant the backend's instance role `ses:SendEmail` for that verified identity and restrict the allowed From address. Use the instance role rather than long-lived keys.

An SES sandbox account can only send to individually verified addresses, addresses at verified domains, or the SES mailbox simulator. AWS must approve production access before sending to other testers. Sender verification and deliverability configuration must also be completed; sending is billed according to SES pricing. Do not deploy this until the sender and IAM access have been verified.

SMTP remains supported as an alternative. When neither provider is configured, development can log codes, but production fails rather than logging them. Test delivery to a real inbox and the complete signup and password reset flows before inviting users.
