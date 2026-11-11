package com.firstwork.prototype;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.cfg.CoercionAction;
import com.fasterxml.jackson.databind.cfg.CoercionInputShape;
import com.fasterxml.jackson.databind.type.LogicalType;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class JsonConfiguration {
  @Bean
  Jackson2ObjectMapperBuilderCustomizer strictJson() {
    return builder -> {
      builder.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
      builder.featuresToDisable(MapperFeature.ALLOW_COERCION_OF_SCALARS);
      builder.postConfigurer(
          mapper ->
              mapper
                  .coercionConfigFor(LogicalType.Textual)
                  .setCoercion(CoercionInputShape.Integer, CoercionAction.Fail)
                  .setCoercion(CoercionInputShape.Float, CoercionAction.Fail)
                  .setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail));
    };
  }
}
