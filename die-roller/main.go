package main

import (
	"context"
	"fmt"
	"github.com/travis-g/dice"
	"log"
	"os"
	"strconv"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: weather <command>")
	}
	ctx := context.Background()

	command := os.Args[1]

	num_dice, err := strconv.Atoi(os.Getenv("NUM_DICE"))
	if err != nil {
		log.Fatal("num_dice was not set to a number")
	}

	num_sides, err := strconv.Atoi(os.Getenv("NUM_SIDES"))
	if err != nil {
		log.Fatal("num_sides was not set to a number")
	}

	switch command {
	case "rollDice":
		group, err := dice.NewRollerGroup(
			&dice.RollerProperties{
				Size:  num_sides,
				Count: num_dice,
			})
		if err != nil {
			log.Fatal(err)
		}
		err = group.FullRoll(ctx)
		if err != nil {
			log.Fatal(err)
		}
		result, err := group.Total(ctx)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%dd%d rolled, result: %d\n", num_dice, num_sides, int(result))
	}

}
