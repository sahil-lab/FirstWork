package com.firstwork.prototype;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed.");
    problem.setTitle("Invalid request");
    List<FieldIssue> errors =
        exception.getBindingResult().getFieldErrors().stream()
            .map(error -> new FieldIssue(error.getField(), error.getDefaultMessage()))
            .toList();
    problem.setProperty("errors", errors);
    return handleExceptionInternal(exception, problem, headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleHttpMessageNotReadable(
      HttpMessageNotReadableException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            "Body must be valid JSON with the documented fields and JSON types.");
    problem.setTitle("Invalid JSON");
    return handleExceptionInternal(exception, problem, headers, status, request);
  }

  @ExceptionHandler(DataAccessException.class)
  ProblemDetail databaseUnavailable(DataAccessException exception) {
    LOG.warn("Database request failed; exceptionType={}", exception.getClass().getSimpleName());
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.SERVICE_UNAVAILABLE,
            "Database is unavailable. Try again after the readiness check passes.");
    problem.setTitle("Database unavailable");
    return problem;
  }

  record FieldIssue(String field, String message) {}
}
