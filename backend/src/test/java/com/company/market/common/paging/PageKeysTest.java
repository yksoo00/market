package com.company.market.common.paging;

import java.util.List;
import java.util.stream.IntStream;

import com.company.market.common.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageKeysTest {

	private static List<Integer> keys(int n) {
		return IntStream.rangeClosed(1, n).boxed().toList();
	}

	@Test
	@DisplayName("1페이지는 앞 키가 없고, 다음 페이지는 앞 페이지의 마지막 줄 키다")
	void boundaries() {
		PageKeys<Integer> first = PageKeys.of(keys(45), 1, 20);
		assertThat(first.after()).isNull();
		assertThat(first.totalPages()).isEqualTo(3);
		assertThat(first.total()).isEqualTo(45);
		assertThat(PageKeys.of(keys(45), 2, 20).after()).isEqualTo(20);
		assertThat(PageKeys.of(keys(45), 3, 20).after()).isEqualTo(40);
	}

	@Test
	@DisplayName("딱 나눠떨어지면 빈 페이지를 만들지 않고, 결과가 없어도 1페이지는 있다")
	void edges() {
		assertThat(PageKeys.of(keys(40), 2, 20).totalPages()).isEqualTo(2);
		PageKeys<Integer> empty = PageKeys.of(List.of(), 1, 20);
		assertThat(empty.totalPages()).isEqualTo(1);
		assertThat(empty.total()).isZero();
	}

	@Test
	@DisplayName("범위 밖 page 는 400")
	void outOfRange() {
		assertThatThrownBy(() -> PageKeys.of(keys(45), 4, 20)).isInstanceOf(ValidationException.class);
		assertThatThrownBy(() -> PageKeys.of(keys(45), 0, 20)).isInstanceOf(ValidationException.class);
		assertThatThrownBy(() -> PageKeys.of(List.of(), 2, 20)).isInstanceOf(ValidationException.class);
	}

}
