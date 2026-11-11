package com.firstwork.prototype;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SandboxController {
  @PostMapping(
      path = "/api/v1/sandbox/validate",
      consumes = MediaType.APPLICATION_JSON_VALUE,
      produces = MediaType.APPLICATION_JSON_VALUE)
  ValidationResult validate(@Valid @RequestBody ValidationRequest request) {
    return new ValidationResult(request.reference(), true, false);
  }

  record ValidationRequest(
      @NotBlank
          @Pattern(
              regexp = "^synthetic-[a-z0-9][a-z0-9-]{0,53}$",
              message =
                  "must start with synthetic- and use lowercase letters, digits, or hyphens (11-64 characters)")
          String reference,
      @NotNull @AssertTrue(message = "must be true; synthetic data only") Boolean synthetic) {}

  record ValidationResult(String reference, boolean accepted, boolean persisted) {}
}
